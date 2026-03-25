'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { login } from '@/lib/api';
import { getPostLoginPath, storeSession } from '@/lib/auth';

const ADMIN_DEMO = {
  email: 'admin@ghoomo.dev',
  password: 'demo12345',
};

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(ADMIN_DEMO.email);
  const [password, setPassword] = useState(ADMIN_DEMO.password);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const session = await login({ email, password });
      storeSession(session);

      const safeNextPath =
        nextPath && nextPath.startsWith('/') ? nextPath : null;
      const redirectTo =
        session.user.role === 'ADMIN' && safeNextPath
          ? safeNextPath
          : getPostLoginPath(session.user.role);

      router.replace(redirectTo);
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to log in.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="glass-panel rounded-[36px] p-8 md:p-10">
      <p className="eyebrow">Account access</p>
      <h1 className="section-title mt-4 text-[2.5rem]">Login to Ghoomo</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
        Admin login is available now. Use the seeded demo credentials below or sign in with
        any existing backend account.
      </p>

      <div className="mt-6 rounded-[24px] border border-[var(--line)] bg-white/60 p-5">
        <p className="text-sm font-semibold">Seeded admin credentials</p>
        <p className="mt-2 font-mono text-sm text-[var(--muted)]">{ADMIN_DEMO.email}</p>
        <p className="font-mono text-sm text-[var(--muted)]">{ADMIN_DEMO.password}</p>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            placeholder="admin@ghoomo.dev"
            autoComplete="email"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            placeholder="demo12345"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Signing in...' : 'Login'}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
        <Link href="/">Back to home</Link>
        <Link href="/guides">Browse guides</Link>
        <Link href="/guides/register">Register as guide</Link>
      </div>
    </div>
  );
}
