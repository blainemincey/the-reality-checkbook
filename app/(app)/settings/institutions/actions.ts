'use server';

import { writeFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { institutionSlug } from '@/ui/components/institution-badge';

const MAX_SVG_BYTES = 64 * 1024; // 64 KB
const SLUG_RE = /^[a-z0-9]+$/;
const LOGO_DIR = path.join(process.cwd(), 'public', 'institutions');

export interface UploadLogoState {
  error?: string;
  success?: string;
}

// Very-basic SVG validation. We only render uploaded SVGs as <img src="...">
// (which isolates script execution in all modern browsers), but we still want
// to reject obvious junk and giant files.
function validateSvg(content: string): string | null {
  const lower = content.toLowerCase();
  if (!lower.includes('<svg')) return 'not an SVG (missing <svg> tag)';
  if (lower.includes('<!entity')) return 'SVG contains DOCTYPE/ENTITY declarations';
  if (content.length > MAX_SVG_BYTES)
    return `SVG is ${Math.round(content.length / 1024)}KB, max is ${MAX_SVG_BYTES / 1024}KB`;
  return null;
}

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
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a file first' };
  }
  if (file.size > MAX_SVG_BYTES) {
    return { error: `File is ${Math.round(file.size / 1024)}KB, max is ${MAX_SVG_BYTES / 1024}KB` };
  }

  const content = await file.text();
  const err = validateSvg(content);
  if (err) return { error: err };

  await mkdir(LOGO_DIR, { recursive: true });
  await writeFile(path.join(LOGO_DIR, `${slug}.svg`), content, 'utf8');

  revalidatePath('/');
  revalidatePath('/settings/institutions');
  revalidatePath('/accounts/[id]', 'page');

  return { success: `Uploaded logo for ${institution}` };
}

export async function deleteInstitutionLogoAction(
  institution: string,
): Promise<UploadLogoState> {
  await requireAuth();

  const slug = institutionSlug(institution);
  if (!SLUG_RE.test(slug)) {
    return { error: `Invalid institution slug "${slug}"` };
  }

  try {
    await unlink(path.join(LOGO_DIR, `${slug}.svg`));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }

  revalidatePath('/');
  revalidatePath('/settings/institutions');
  revalidatePath('/accounts/[id]', 'page');

  return { success: `Removed logo for ${institution}` };
}
