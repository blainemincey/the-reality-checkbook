import { redirectIfAuthed } from '@/lib/auth/guards';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  await redirectIfAuthed('/');
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wider text-text-tertiary">check register</p>
          <h1 className="mt-1 text-xl font-medium">Sign in</h1>
        </header>
        <LoginForm />
      </div>
    </main>
  );
}
