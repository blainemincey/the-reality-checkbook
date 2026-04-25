import { redirectIfAuthed } from '@/lib/auth/guards';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  await redirectIfAuthed('/');
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <header className="mb-6 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_14px_rgb(var(--color-accent)/0.7)]" />
          The Reality Checkbook
        </header>
        <div className="card p-6">
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-text-tertiary">
            Access the household ledger.
          </p>
          <div className="mt-5">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
