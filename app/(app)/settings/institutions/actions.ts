'use server';

import { writeFile, unlink, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { institutionSlug } from '@/ui/components/institution-logos';

const MAX_IMAGE_BYTES = 256 * 1024; // 256 KB — enough for typical brand assets
const FETCH_TIMEOUT_MS = 10_000;
const SLUG_RE = /^[a-z0-9]+$/;
const LOGO_DIR = path.join(process.cwd(), 'public', 'institutions');

type ImageExt = 'svg' | 'png' | 'jpg' | 'webp' | 'gif';

export interface UploadLogoState {
  error?: string;
  success?: string;
}

/**
 * Detect image kind from bytes (magic numbers). Returns null if unknown.
 * SVG detection is by textual marker, not magic bytes.
 */
function detectKind(bytes: Uint8Array): ImageExt | null {
  if (bytes.length < 4) return null;

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'png';
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  // GIF: GIF87a or GIF89a
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return 'webp';
  // SVG: textual, sniff first 512 bytes for "<svg"
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.slice(0, Math.min(bytes.length, 512)))
    .toLowerCase();
  if (head.includes('<svg')) return 'svg';
  return null;
}

function validateSvgText(content: string): string | null {
  const lower = content.toLowerCase();
  if (!lower.includes('<svg')) return 'not an SVG (missing <svg> tag)';
  if (lower.includes('<!entity') || lower.includes('<!doctype'))
    return 'SVG contains DOCTYPE/ENTITY declarations';
  return null;
}

async function writeLogo(slug: string, bytes: Uint8Array, ext: ImageExt): Promise<void> {
  await mkdir(LOGO_DIR, { recursive: true });
  // Remove any existing logo for this slug with a different extension.
  try {
    const existing = await readdir(LOGO_DIR);
    for (const f of existing) {
      const m = f.match(/^(.+)\.([a-z0-9]+)$/i);
      if (m && m[1]?.toLowerCase() === slug && m[2]?.toLowerCase() !== ext) {
        await unlink(path.join(LOGO_DIR, f)).catch(() => {});
      }
    }
  } catch {
    // dir may not exist yet, fine
  }
  await writeFile(path.join(LOGO_DIR, `${slug}.${ext}`), bytes);
}

function revalidateLogoPaths() {
  revalidatePath('/');
  revalidatePath('/settings/institutions');
  revalidatePath('/accounts/[id]', 'page');
}

// ---------------------------------------------------------------------------
// File upload
// ---------------------------------------------------------------------------

export async function uploadInstitutionLogoAction(
  institution: string,
  _prev: UploadLogoState,
  formData: FormData,
): Promise<UploadLogoState> {
  await requireAuth();

  const slug = institutionSlug(institution);
  if (!SLUG_RE.test(slug)) {
    return { error: `Invalid institution slug "${slug}"` };
  }

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file first' };
  if (file.size > MAX_IMAGE_BYTES)
    return { error: `File is ${Math.round(file.size / 1024)}KB, max is ${MAX_IMAGE_BYTES / 1024}KB` };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectKind(bytes);
  if (!kind) return { error: 'Unrecognized image format (use SVG, PNG, JPEG, WebP, or GIF)' };

  if (kind === 'svg') {
    const err = validateSvgText(new TextDecoder().decode(bytes));
    if (err) return { error: err };
  }

  await writeLogo(slug, bytes, kind);
  revalidateLogoPaths();
  return { success: `Uploaded ${kind.toUpperCase()} logo for ${institution}` };
}

// ---------------------------------------------------------------------------
// URL import
// ---------------------------------------------------------------------------

export async function importInstitutionLogoFromUrlAction(
  institution: string,
  _prev: UploadLogoState,
  formData: FormData,
): Promise<UploadLogoState> {
  await requireAuth();

  const slug = institutionSlug(institution);
  if (!SLUG_RE.test(slug)) return { error: `Invalid institution slug "${slug}"` };

  const rawUrl = String(formData.get('url') ?? '').trim();
  if (!rawUrl) return { error: 'Enter a URL' };

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { error: 'Invalid URL' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { error: 'Only http/https URLs' };
  }

  let response: Response;
  try {
    response = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'check-register-logo-import/1.0',
        Accept: 'image/svg+xml,image/png,image/jpeg,image/webp,image/gif;q=0.9,*/*;q=0.5',
      },
    });
  } catch (e) {
    return { error: `Fetch failed: ${(e as Error).message}` };
  }
  if (!response.ok) return { error: `HTTP ${response.status} from ${parsed.hostname}` };

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    return {
      error: `Remote file is ${Math.round(contentLength / 1024)}KB, max is ${MAX_IMAGE_BYTES / 1024}KB`,
    };
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return {
      error: `Remote file is ${Math.round(buffer.byteLength / 1024)}KB, max is ${MAX_IMAGE_BYTES / 1024}KB`,
    };
  }
  const bytes = new Uint8Array(buffer);
  const kind = detectKind(bytes);
  if (!kind) return { error: 'URL returned an unrecognized image format' };

  if (kind === 'svg') {
    const err = validateSvgText(new TextDecoder().decode(bytes));
    if (err) return { error: err };
  }

  await writeLogo(slug, bytes, kind);
  revalidateLogoPaths();
  return { success: `Imported ${kind.toUpperCase()} logo for ${institution}` };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteInstitutionLogoAction(
  institution: string,
): Promise<UploadLogoState> {
  await requireAuth();

  const slug = institutionSlug(institution);
  if (!SLUG_RE.test(slug)) return { error: `Invalid institution slug "${slug}"` };

  try {
    const entries = await readdir(LOGO_DIR).catch(() => []);
    await Promise.all(
      entries
        .filter((f) => {
          const m = f.match(/^(.+)\.([a-z0-9]+)$/i);
          return m !== null && m[1]?.toLowerCase() === slug;
        })
        .map((f) => unlink(path.join(LOGO_DIR, f)).catch(() => {})),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }

  revalidateLogoPaths();
  return { success: `Removed logo for ${institution}` };
}
