'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { registerUser } from '@/lib/api';
import { storeSession } from '@/lib/auth';

export function UserRegistrationForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const session = await registerUser({
        fullName,
        email,
        password,
        phone: phone || undefined,
      });

      storeSession(session);
      router.replace('/');
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to create account.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="glass-panel rounded-[36px] p-8 md:p-10">
      <p className="eyebrow">User registration</p>
      <h1 className="section-title mt-4 text-[2.5rem]">Create your Ghoomo account</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
        Normal users are created with the `USER` role and are redirected back to the home
        screen after registration.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="field-control w-full rounded-2xl px-4 py-3 outline-none"
            placeholder="Your full name"
            autoComplete="name"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field-control w-full rounded-2xl px-4 py-3 outline-none"
            placeholder="you@example.com"
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
            className="field-control w-full rounded-2xl px-4 py-3 outline-none"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="field-control w-full rounded-2xl px-4 py-3 outline-none"
            placeholder="Optional"
            autoComplete="tel"
          />
        </label>

        {error ? (
          <div className="message-error rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Creating account...' : 'Register'}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
        <Link href="/">Back to home</Link>
        <Link href="/login">Login</Link>
        <Link href="/guides/register">Register as guide</Link>
      </div>
    </div>
  );
}
