'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { registerGuide } from '@/lib/api';

type FormState = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  bio: string;
  hourlyRate: string;
  languages: string;
  specialties: string;
};

const initialState: FormState = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  city: '',
  bio: '',
  hourlyRate: '',
  languages: 'English, Hindi',
  specialties: 'Walking tours, Local food',
};

function toList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function GuideRegistrationForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await registerGuide({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        city: form.city,
        bio: form.bio || undefined,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        languages: toList(form.languages),
        specialties: toList(form.specialties),
      });

      setIsSuccess(true);
      setForm(initialState);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to submit guide registration.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="glass-panel rounded-[36px] p-8 md:p-10">
        <p className="eyebrow">Guide onboarding</p>
        <h1 className="section-title mt-4 text-[2.4rem]">Register as a local guide</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Submit your guide profile here. New guide accounts are created immediately but stay in
          the admin review queue until approved, so they will not appear publicly right away.
        </p>

        {isSuccess ? (
          <div className="mt-8 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
            <p className="text-base font-semibold">Registration submitted.</p>
            <p className="mt-2 text-sm leading-6">
              Your guide profile is now pending admin approval. Once approved, your city and
              profile will appear in the public guide directory and homepage coverage section.
            </p>
          </div>
        ) : null}

        <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Full name</span>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">City</span>
              <input
                type="text"
                value={form.city}
                onChange={(event) => updateField('city', event.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                required
              />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
                minLength={8}
                required
              />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Phone</span>
              <input
                type="text"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Hourly rate (INR)</span>
              <input
                type="number"
                min="0"
                value={form.hourlyRate}
                onChange={(event) => updateField('hourlyRate', event.target.value)}
                className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Bio</span>
            <textarea
              value={form.bio}
              onChange={(event) => updateField('bio', event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Languages</span>
            <input
              type="text"
              value={form.languages}
              onChange={(event) => updateField('languages', event.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              placeholder="English, Hindi, Marathi"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Specialties</span>
            <input
              type="text"
              value={form.specialties}
              onChange={(event) => updateField('specialties', event.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
              placeholder="Temple tours, Food walks"
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
            className="w-fit rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Submitting...' : 'Submit guide profile'}
          </button>
        </form>
      </section>

      <aside className="glass-panel rounded-[36px] p-8 md:p-10">
        <p className="eyebrow">What happens next</p>
        <div className="mt-6 space-y-5">
          {[
            'Your profile is created with pending verification status.',
            'Admin reviews your city, languages, specialties, and basic details.',
            'After approval, your profile appears on the public guides page.',
            'Your city then shows up in the homepage coverage section if it is live.',
          ].map((step) => (
            <div key={step} className="rounded-[24px] border border-[var(--line)] bg-white/60 p-5">
              <p className="text-sm leading-7 text-[var(--muted)]">{step}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-[var(--accent-strong)]">
          <Link href="/">Home</Link>
          <Link href="/guides">Public guides</Link>
          <Link href="/login">Admin login</Link>
        </div>
      </aside>
    </div>
  );
}
