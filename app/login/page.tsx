import { redirectIfAuthed } from '@/lib/auth/guards';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  await redirectIfAuthed('/');
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <header className="mb-8">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_rgb(var(--color-accent)/0.6)]" />
            Mincey Family Finances
          </div>
          <h1 className="text-xl font-medium">Sign in</h1>
        </header>
        <LoginForm />
      </div>
    </main>
  );
}
