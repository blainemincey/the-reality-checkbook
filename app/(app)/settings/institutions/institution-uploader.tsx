'use client';

import { useActionState, useRef, useTransition } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import {
  uploadInstitutionLogoAction,
  deleteInstitutionLogoAction,
  type UploadLogoState,
} from './actions';

interface Props {
  institution: string;
  hasLogo: boolean;
}

const initial: UploadLogoState = {};

export function InstitutionUploader({ institution, hasLogo }: Props) {
  const boundUpload = uploadInstitutionLogoAction.bind(null, institution);
  const [state, action, pending] = useActionState(boundUpload, initial);
  const [deleting, startDelete] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleDelete = () => {
    startDelete(async () => {
      await deleteInstitutionLogoAction(institution);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <form ref={formRef} action={action} className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            name="logo"
            accept="image/svg+xml,.svg"
            className="sr-only"
            onChange={() => formRef.current?.requestSubmit()}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="btn-ghost"
          >
            <Upload size={12} strokeWidth={2} />
            {pending ? 'Uploading…' : hasLogo ? 'Replace' : 'Upload SVG'}
          </button>
        </form>
        {hasLogo && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="btn-ghost text-debit"
            aria-label="Remove logo"
            title="Remove logo"
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        )}
      </div>
      {state.error && <p className="text-xs text-debit">{state.error}</p>}
      {state.success && <p className="text-xs text-credit">{state.success}</p>}
    </div>
  );
}
