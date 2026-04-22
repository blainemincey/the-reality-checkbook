'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import { Upload, Link2, Trash2 } from 'lucide-react';
import {
  uploadInstitutionLogoAction,
  importInstitutionLogoFromUrlAction,
  deleteInstitutionLogoAction,
  type UploadLogoState,
} from './actions';

interface Props {
  institution: string;
  hasLogo: boolean;
}

const initialUpload: UploadLogoState = {};
const initialImport: UploadLogoState = {};

export function InstitutionUploader({ institution, hasLogo }: Props) {
  const boundUpload = uploadInstitutionLogoAction.bind(null, institution);
  const boundImport = importInstitutionLogoFromUrlAction.bind(null, institution);
  const [uploadState, uploadAction, uploading] = useActionState(boundUpload, initialUpload);
  const [importState, importAction, importing] = useActionState(boundImport, initialImport);
  const [deleting, startDelete] = useTransition();
  const [showUrl, setShowUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFormRef = useRef<HTMLFormElement>(null);

  const handleDelete = () => {
    startDelete(async () => {
      await deleteInstitutionLogoAction(institution);
    });
  };

  const busy = uploading || importing || deleting;
  const errorMsg = uploadState.error ?? importState.error;
  const successMsg = uploadState.success ?? importState.success;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {/* File upload */}
        <form ref={uploadFormRef} action={uploadAction}>
          <input
            ref={fileRef}
            type="file"
            name="logo"
            accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif,.svg,.png,.jpg,.jpeg,.webp,.gif"
            className="sr-only"
            onChange={() => uploadFormRef.current?.requestSubmit()}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="btn-ghost"
          >
            <Upload size={12} strokeWidth={2} />
            {uploading ? 'Uploading…' : hasLogo ? 'Replace' : 'Upload'}
          </button>
        </form>

        {/* URL import toggle */}
        <button
          type="button"
          onClick={() => setShowUrl((v) => !v)}
          disabled={busy}
          className={`btn-ghost ${showUrl ? 'text-accent border-accent' : ''}`}
          title="Import from URL"
        >
          <Link2 size={12} strokeWidth={2} />
          URL
        </button>

        {hasLogo && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="btn-ghost text-debit"
            aria-label="Remove logo"
            title="Remove logo"
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        )}
      </div>

      {showUrl && (
        <form action={importAction} className="flex items-center gap-2">
          <input
            name="url"
            type="url"
            required
            placeholder="https://…/logo.svg"
            disabled={busy}
            className="input w-72 !py-1 text-xs"
          />
          <button type="submit" disabled={busy} className="btn-primary !px-2.5 !py-1 text-xs">
            {importing ? 'Fetching…' : 'Import'}
          </button>
        </form>
      )}

      {errorMsg && <p className="text-xs text-debit">{errorMsg}</p>}
      {successMsg && <p className="text-xs text-credit">{successMsg}</p>}
    </div>
  );
}
