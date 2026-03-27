'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  getCities,
  getCurrentUser,
  getMyGuide,
  updateMyGuide,
  type AuthUser,
  type Guide,
} from '@/lib/api';
import { clearSession, getStoredSession } from '@/lib/auth';

type GuideEditFormState = {
  city: string;
  hourlyRate: string;
  bio: string;
  languages: string;
  specialties: string;
};

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : 'Not available';
}

function toProfileImageSrc(base64: string, mimeType: string) {
  return `data:${mimeType};base64,${base64}`;
}

function toCommaSeparatedList(items: string[]) {
  return items.join(', ');
}

function toList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createEditForm(guide: Guide): GuideEditFormState {
  return {
    city: guide.city,
    hourlyRate: guide.hourlyRate?.toString() ?? '',
    bio: guide.bio ?? '',
    languages: toCommaSeparatedList(guide.languages),
    specialties: toCommaSeparatedList(guide.specialties),
  };
}

function GuideStatusBadge({
  status,
}: {
  status: Guide['verificationStatus'];
}) {
  const className =
    status === 'PENDING'
      ? 'warning-badge'
      : status === 'APPROVED'
        ? 'status-badge'
        : 'border border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error-text)]';

  return (
    <span className={`${className} rounded-full px-3 py-1 text-xs font-semibold`}>
      {status}
    </span>
  );
}

export function GuideDashboard() {
  const router = useRouter();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [editForm, setEditForm] = useState<GuideEditFormState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function load() {
      const session = getStoredSession();

      if (!session) {
        router.replace('/login?next=/guides');
        return;
      }

      if (session.user.role === 'ADMIN') {
        router.replace('/admin');
        return;
      }

      if (session.user.role === 'USER' || session.user.role === 'TOURIST') {
        router.replace('/');
        return;
      }

      try {
        const [nextUser, nextGuide, cities] = await Promise.all([
          getCurrentUser(session.accessToken),
          getMyGuide(session.accessToken),
          getCities().catch(() => []),
        ]);

        if (!isActive) {
          return;
        }

        setUser(nextUser);
        setGuide(nextGuide);
        setEditForm(createEditForm(nextGuide));
        setAvailableCities(cities.map((city) => city.name));
        setError(null);
      } catch (loadError) {
        clearSession();

        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load guide profile.',
        );
        router.replace('/login?next=/guides');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [router]);

  function handleLogout() {
    clearSession();
    router.replace('/');
    router.refresh();
  }

  function handleEditField<Key extends keyof GuideEditFormState>(
    key: Key,
    value: GuideEditFormState[Key],
  ) {
    setEditForm((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    );
  }

  function handleStartEditing() {
    if (!guide) {
      return;
    }

    setEditForm(createEditForm(guide));
    setIsEditing(true);
    setError(null);
    setSuccessMessage(null);
  }

  function handleCancelEditing() {
    if (!guide) {
      return;
    }

    setEditForm(createEditForm(guide));
    setIsEditing(false);
    setError(null);
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!guide || !editForm) {
      return;
    }

    const session = getStoredSession();
    if (!session) {
      router.replace('/login?next=/guides');
      return;
    }

    const languages = toList(editForm.languages);
    const specialties = toList(editForm.specialties);

    if (!editForm.city.trim()) {
      setError('City is required.');
      return;
    }

    if (!languages.length) {
      setError('Add at least one language.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedGuide = await updateMyGuide(session.accessToken, {
        city: editForm.city.trim(),
        bio: editForm.bio.trim() || null,
        hourlyRate: editForm.hourlyRate.trim()
          ? Number(editForm.hourlyRate)
          : null,
        languages,
        specialties,
      });

      setGuide(updatedGuide);
      setEditForm(createEditForm(updatedGuide));
      setIsEditing(false);
      setSuccessMessage(
        'Profile updated. Your guide card is now pending admin approval again.',
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to update your guide profile.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="glass-panel rounded-[36px] p-8 md:p-10">
        <p className="eyebrow">Guide account</p>
        <h1 className="section-title mt-4 text-[2.4rem]">Loading your guide card</h1>
        <p className="mt-4 text-base text-[var(--muted)]">
          Fetching the guide profile linked to your account.
        </p>
      </div>
    );
  }

  if (!guide || !user) {
    return (
      <div className="glass-panel rounded-[36px] p-8 md:p-10">
        <p className="eyebrow">Guide account</p>
        <h1 className="section-title mt-4 text-[2.4rem]">Guide profile unavailable</h1>
        <p className="mt-4 text-base text-[var(--muted)]">
          {error ?? 'This account does not have a guide profile yet.'}
        </p>
      </div>
    );
  }

  const hasProfileImage = Boolean(
    guide.profileImageBase64 && guide.profileImageMimeType,
  );
  const cityOptions = Array.from(
    new Set([...availableCities, guide.city].filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

  return (
    <div className="space-y-8">
      <header className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-[32px] px-5 py-3">
        <Link href="/" className="font-mono text-sm uppercase tracking-[0.2em]">
          Ghoomo
        </Link>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
          <Link href="/">Home</Link>
          <button type="button" onClick={handleLogout} className="font-semibold">
            Logout
          </button>
        </div>
      </header>

      <section className="glass-panel rounded-[36px] p-8 md:p-10">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="eyebrow">Guide dashboard</p>
            <h1 className="section-title mt-4 text-[2.6rem]">{guide.user.fullName}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Only your own guide card is visible here. The full guide listing stays inside the
              admin dashboard.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <GuideStatusBadge status={guide.verificationStatus} />
              <button
                type="button"
                onClick={handleStartEditing}
                className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
              >
                Edit profile
              </button>
            </div>
          </div>
          {hasProfileImage ? (
            <div className="contrast-panel overflow-hidden rounded-[28px] p-4">
              <div className="relative overflow-hidden rounded-[22px]">
                <Image
                  src={toProfileImageSrc(
                    guide.profileImageBase64!,
                    guide.profileImageMimeType!,
                  )}
                  alt={`${guide.user.fullName} profile image`}
                  width={800}
                  height={1000}
                  className="h-80 w-full object-cover"
                  unoptimized
                />
              </div>
              <p className="mt-3 text-sm text-[var(--contrast-muted)]">
                Stored profile image from your guide verification record.
              </p>
            </div>
          ) : null}
        </div>

        {successMessage ? (
          <div className="message-success mt-6 rounded-2xl px-4 py-3 text-sm">
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="message-error mt-6 rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        {isEditing && editForm ? (
          <form
            className="panel-tint mt-6 rounded-[30px] p-6"
            onSubmit={(event) => void handleSaveProfile(event)}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold">Edit guide profile</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Saving profile changes moves this guide back into admin review.
                </p>
              </div>
              <span className="text-sm font-medium text-[var(--accent-strong)]">
                Email stays read-only
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">City</span>
                <select
                  value={editForm.city}
                  onChange={(event) => handleEditField('city', event.target.value)}
                  className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                >
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Hourly rate
                </span>
                <input
                  type="number"
                  min="0"
                  value={editForm.hourlyRate}
                  onChange={(event) =>
                    handleEditField('hourlyRate', event.target.value)
                  }
                  className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                  placeholder="Rate per hour"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium">Bio</span>
                <textarea
                  value={editForm.bio}
                  onChange={(event) => handleEditField('bio', event.target.value)}
                  className="field-control min-h-28 w-full rounded-2xl px-4 py-3 outline-none"
                  placeholder="Tell travelers what you guide them through."
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Languages
                </span>
                <input
                  type="text"
                  value={editForm.languages}
                  onChange={(event) =>
                    handleEditField('languages', event.target.value)
                  }
                  className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                  placeholder="English, Hindi"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">
                  Specialties
                </span>
                <input
                  type="text"
                  value={editForm.specialties}
                  onChange={(event) =>
                    handleEditField('specialties', event.target.value)
                  }
                  className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                  placeholder="Walking tours, Food trails"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? 'Sending for approval...' : 'Save and send for approval'}
              </button>
              <button
                type="button"
                onClick={handleCancelEditing}
                className="button-secondary rounded-full px-5 py-3 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Role
            </p>
            <p className="mt-2 text-lg font-semibold">{user.role}</p>
          </div>
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              City
            </p>
            <p className="mt-2 text-lg font-semibold">{guide.city}</p>
          </div>
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Hourly rate
            </p>
            <p className="mt-2 text-lg font-semibold">
              {guide.hourlyRate ? `INR ${guide.hourlyRate}/hr` : 'Rate not provided'}
            </p>
          </div>
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Submitted
            </p>
            <p className="mt-2 text-lg font-semibold">{formatDate(guide.createdAt)}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="panel-tint rounded-[28px] p-6">
            <p className="eyebrow">Account info</p>
            <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
              <p>
                <span className="font-semibold text-[var(--foreground)]">Email:</span>{' '}
                {guide.user.email}
              </p>
              <p>
                <span className="font-semibold text-[var(--foreground)]">Availability:</span>{' '}
                {guide.isAvailable ? 'Available' : 'Busy'}
              </p>
              <p>
                <span className="font-semibold text-[var(--foreground)]">Reviews:</span>{' '}
                {guide.reviewCount}
              </p>
              <p>
                <span className="font-semibold text-[var(--foreground)]">Rating:</span>{' '}
                {guide.averageRating ? `${guide.averageRating} / 5` : 'No rating yet'}
              </p>
            </div>
          </article>

          <article className="panel-tint rounded-[28px] p-6">
            <p className="eyebrow">Profile summary</p>
            <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
              {guide.bio ?? 'No bio provided yet.'}
            </p>
          </article>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="panel-tint rounded-[28px] p-6">
            <p className="eyebrow">Languages</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {guide.languages.map((language) => (
                <span
                  key={language}
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium"
                >
                  {language}
                </span>
              ))}
            </div>
          </article>

          <article className="panel-tint rounded-[28px] p-6">
            <p className="eyebrow">Specialties</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {guide.specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="tag-soft rounded-full px-3 py-1 text-xs font-medium"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
