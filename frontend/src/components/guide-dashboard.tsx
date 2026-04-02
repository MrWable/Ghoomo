'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  getMyBookings,
  createGuideAvailabilityBlock,
  deleteGuideAvailabilityBlock,
  getCities,
  getCurrentUser,
  getMyGuide,
  updateBookingStatus,
  updateGuideBookingPreference,
  updateMyGuide,
  type AuthUser,
  type Booking,
  type BookingStatus,
  type Guide,
  type GuideAvailabilityBlock,
  type PaymentStatus,
} from '@/lib/api';
import { clearSession, getStoredSession } from '@/lib/auth';

type GuideEditFormState = {
  city: string;
  hourlyRate: string;
  bio: string;
  languages: string;
  specialties: string;
};

type AvailabilityFormState = {
  startAt: string;
  endAt: string;
  reason: string;
};

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : 'Not available';
}

function formatDateTime(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Not scheduled';
}

function formatDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function createDefaultAvailabilityForm(): AvailabilityFormState {
  const startAt = new Date();
  startAt.setDate(startAt.getDate() + 1);
  startAt.setHours(9, 0, 0, 0);

  const endAt = new Date(startAt);
  endAt.setHours(endAt.getHours() + 8);

  return {
    startAt: formatDateTimeLocalValue(startAt),
    endAt: formatDateTimeLocalValue(endAt),
    reason: '',
  };
}

function sortAvailabilityBlocks(blocks: GuideAvailabilityBlock[]) {
  return [...blocks].sort(
    (left, right) =>
      new Date(left.startAt).getTime() - new Date(right.startAt).getTime(),
  );
}

function sortBookings(bookings: Booking[]) {
  return [...bookings].sort((left, right) => {
    const statusOrder: Record<BookingStatus, number> = {
      PENDING: 0,
      CONFIRMED: 1,
      IN_PROGRESS: 2,
      COMPLETED: 3,
      NO_SHOW: 4,
      CANCELLED: 5,
      REJECTED: 6,
    };
    const statusDifference = statusOrder[left.status] - statusOrder[right.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const leftTime = new Date(left.startAt).getTime();
    const rightTime = new Date(right.startAt).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
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

function formatCurrency(amount: number | null) {
  return amount == null
    ? 'Quoted later'
    : `INR ${amount.toLocaleString('en-IN')}`;
}

function formatBookingStatusLabel(status: BookingStatus) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const className =
    status === 'PENDING'
      ? 'warning-badge'
      : status === 'CONFIRMED' || status === 'IN_PROGRESS'
        ? 'status-badge'
        : status === 'COMPLETED'
          ? 'tag-soft'
          : 'border border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error-text)]';

  return (
    <span className={`${className} rounded-full px-3 py-1 text-xs font-semibold`}>
      {formatBookingStatusLabel(status)}
    </span>
  );
}

function formatPaymentStatusLabel(status: PaymentStatus) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const className =
    status === 'PAID'
      ? 'status-badge'
      : status === 'ORDER_CREATED'
        ? 'warning-badge'
        : status === 'FAILED'
          ? 'border border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error-text)]'
          : 'tag-soft';

  return (
    <span className={`${className} rounded-full px-3 py-1 text-xs font-semibold`}>
      {formatPaymentStatusLabel(status)}
    </span>
  );
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [editForm, setEditForm] = useState<GuideEditFormState | null>(null);
  const [availabilityForm, setAvailabilityForm] = useState<AvailabilityFormState>(
    createDefaultAvailabilityForm(),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [isCreatingAvailabilityBlock, setIsCreatingAvailabilityBlock] =
    useState(false);
  const [removingAvailabilityBlockId, setRemovingAvailabilityBlockId] =
    useState<string | null>(null);
  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
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
        const [nextUser, nextGuide, cities, guideBookings] = await Promise.all([
          getCurrentUser(session.accessToken),
          getMyGuide(session.accessToken),
          getCities().catch(() => []),
          getMyBookings(session.accessToken),
        ]);

        if (!isActive) {
          return;
        }

        setUser(nextUser);
        setGuide(nextGuide);
        setBookings(sortBookings(guideBookings));
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

  function handleAvailabilityField<Key extends keyof AvailabilityFormState>(
    key: Key,
    value: AvailabilityFormState[Key],
  ) {
    setAvailabilityForm((current) => ({
      ...current,
      [key]: value,
    }));
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

  async function handleBookingPreferenceUpdate(acceptingBookings: boolean) {
    const session = getStoredSession();

    if (!session) {
      router.replace('/login?next=/guides');
      return;
    }

    setIsUpdatingAvailability(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedGuide = await updateGuideBookingPreference(
        session.accessToken,
        acceptingBookings,
      );

      setGuide(updatedGuide);
      setSuccessMessage(
        acceptingBookings
          ? 'Your guide card is now open for new booking requests.'
          : 'Your guide card is paused for new booking requests.',
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update booking preference.',
      );
    } finally {
      setIsUpdatingAvailability(false);
    }
  }

  async function handleCreateAvailabilityBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const session = getStoredSession();

    if (!session) {
      router.replace('/login?next=/guides');
      return;
    }

    const startAt = new Date(availabilityForm.startAt);
    const endAt = new Date(availabilityForm.endAt);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setError('Enter a valid blocked time range.');
      return;
    }

    if (endAt <= startAt) {
      setError('Blocked end time must be after the start time.');
      return;
    }

    setIsCreatingAvailabilityBlock(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const block = await createGuideAvailabilityBlock(session.accessToken, {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        reason: availabilityForm.reason.trim() || undefined,
      });

      setGuide((current) =>
        current
          ? {
              ...current,
              availabilityBlocks: sortAvailabilityBlocks([
                ...(current.availabilityBlocks ?? []),
                block,
              ]),
            }
          : current,
      );
      setAvailabilityForm(createDefaultAvailabilityForm());
      setSuccessMessage(
        'Blocked slot added. Travellers will see it on the booking screen.',
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to add this blocked slot.',
      );
    } finally {
      setIsCreatingAvailabilityBlock(false);
    }
  }

  async function handleDeleteAvailabilityBlock(blockId: string) {
    const session = getStoredSession();

    if (!session) {
      router.replace('/login?next=/guides');
      return;
    }

    setRemovingAvailabilityBlockId(blockId);
    setError(null);
    setSuccessMessage(null);

    try {
      await deleteGuideAvailabilityBlock(session.accessToken, blockId);

      setGuide((current) =>
        current
          ? {
              ...current,
              availabilityBlocks: (current.availabilityBlocks ?? []).filter(
                (block) => block.id !== blockId,
              ),
            }
          : current,
      );
      setSuccessMessage('Blocked slot removed.');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to remove this blocked slot.',
      );
    } finally {
      setRemovingAvailabilityBlockId(null);
    }
  }

  async function handleBookingAction(
    bookingId: string,
    status: 'CONFIRMED' | 'REJECTED',
  ) {
    const session = getStoredSession();

    if (!session) {
      router.replace('/login?next=/guides');
      return;
    }

    setBookingActionId(bookingId);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedBooking = await updateBookingStatus(session.accessToken, bookingId, {
        status,
      });

      setBookings((current) =>
        sortBookings(
          current.map((booking) =>
            booking.id === bookingId ? updatedBooking : booking,
          ),
        ),
      );
      setSuccessMessage(
        status === 'CONFIRMED'
          ? 'Booking request accepted.'
          : 'Booking request rejected.',
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Unable to update this booking request.',
      );
    } finally {
      setBookingActionId(null);
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
  const availabilityBlocks = sortAvailabilityBlocks(guide.availabilityBlocks ?? []);
  const pendingBookings = bookings.filter((booking) => booking.status === 'PENDING');
  const confirmedBookings = bookings.filter(
    (booking) => booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS',
  );
  const completedBookings = bookings.filter(
    (booking) => booking.status === 'COMPLETED',
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
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Pending requests
            </p>
            <p className="mt-2 text-lg font-semibold">{pendingBookings.length}</p>
          </div>
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Active services
            </p>
            <p className="mt-2 text-lg font-semibold">{confirmedBookings.length}</p>
          </div>
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Completed
            </p>
            <p className="mt-2 text-lg font-semibold">{completedBookings.length}</p>
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
                {guide.acceptingBookings ? 'Accepting bookings' : 'Paused'}
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
            <p className="eyebrow">Booking controls</p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Turn new booking requests on or off for your public guide card.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleBookingPreferenceUpdate(true)}
                disabled={
                  isUpdatingAvailability ||
                  guide.verificationStatus !== 'APPROVED' ||
                  guide.acceptingBookings
                }
                className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUpdatingAvailability && !guide.acceptingBookings
                  ? 'Updating...'
                  : 'Accept bookings'}
              </button>
              <button
                type="button"
                onClick={() => void handleBookingPreferenceUpdate(false)}
                disabled={isUpdatingAvailability || !guide.acceptingBookings}
                className="button-secondary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isUpdatingAvailability && guide.acceptingBookings
                  ? 'Updating...'
                  : 'Pause bookings'}
              </button>
            </div>
            <p className="mt-4 text-sm text-[var(--muted)]">
              {guide.verificationStatus === 'APPROVED'
                ? guide.acceptingBookings
                  ? 'Travellers can currently request you from the city booking flow.'
                  : 'Your card stays visible, but travellers cannot send new requests.'
                : 'Booking controls unlock after admin approval.'}
            </p>
          </article>

          <article className="panel-tint rounded-[28px] p-6">
            <p className="eyebrow">Blocked dates</p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Add days or time ranges when you do not want to receive bookings.
            </p>
            <form
              onSubmit={(event) => void handleCreateAvailabilityBlock(event)}
              className="mt-5 space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Start</span>
                  <input
                    type="datetime-local"
                    value={availabilityForm.startAt}
                    onChange={(event) =>
                      handleAvailabilityField('startAt', event.target.value)
                    }
                    className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">End</span>
                  <input
                    type="datetime-local"
                    value={availabilityForm.endAt}
                    onChange={(event) =>
                      handleAvailabilityField('endAt', event.target.value)
                    }
                    className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">Reason</span>
                <input
                  type="text"
                  value={availabilityForm.reason}
                  onChange={(event) =>
                    handleAvailabilityField('reason', event.target.value)
                  }
                  className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                  placeholder="Leave, private tour, travel day..."
                />
              </label>

              <button
                type="submit"
                disabled={isCreatingAvailabilityBlock}
                className="button-secondary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isCreatingAvailabilityBlock ? 'Saving block...' : 'Add blocked slot'}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              {availabilityBlocks.length > 0 ? (
                availabilityBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-pill)] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {formatDateTime(block.startAt)} to {formatDateTime(block.endAt)}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {block.reason ?? 'No reason provided.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAvailabilityBlock(block.id)}
                        disabled={removingAvailabilityBlockId === block.id}
                        className="button-secondary rounded-full px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {removingAvailabilityBlockId === block.id
                          ? 'Removing...'
                          : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-pill)] px-4 py-3 text-sm text-[var(--muted)]">
                  No blocked slots yet. Travellers will see future blocks on the booking page.
                </div>
              )}
            </div>
          </article>

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

        <article className="panel-tint mt-6 rounded-[28px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Service bookings</p>
              <h2 className="mt-3 text-2xl font-semibold">
                Requests and confirmed tours for your guide card
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                Every traveller request sent to this guide appears here. Pending rows can
                be accepted or rejected directly from the table.
              </p>
            </div>
            <div className="contrast-panel rounded-[24px] px-4 py-3 text-sm shadow-none">
              {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-[var(--line)]">
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full text-left text-sm">
                <thead className="bg-[var(--surface-pill)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Traveller</th>
                    <th className="px-4 py-3 font-semibold">Slot</th>
                    <th className="px-4 py-3 font-semibold">Guests</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">Meeting point</th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Requested</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length > 0 ? (
                    bookings.map((booking) => {
                      const isPending = booking.status === 'PENDING';
                      const isUpdating = bookingActionId === booking.id;

                      return (
                        <tr
                          key={booking.id}
                          className="border-t border-[var(--line)] align-top"
                        >
                          <td className="px-4 py-4">
                            <p className="font-semibold">{booking.tourist.fullName}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {booking.tourist.email}
                            </p>
                            {booking.message ? (
                              <p className="mt-2 max-w-xs text-xs leading-6 text-[var(--muted)]">
                                {booking.message}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-medium">
                              {formatDateTime(booking.startAt)}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              Until {formatDateTime(booking.endAt)}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {booking.guestCount}
                          </td>
                          <td className="px-4 py-4">
                            <BookingStatusBadge status={booking.status} />
                          </td>
                          <td className="px-4 py-4">
                            <PaymentStatusBadge status={booking.paymentStatus} />
                            {booking.paymentPaidAt ? (
                              <p className="mt-2 text-xs text-[var(--muted)]">
                                Paid on {formatDateTime(booking.paymentPaidAt)}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {booking.meetingPoint ?? 'Not shared yet'}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {formatCurrency(booking.totalAmount)}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {formatDateTime(booking.createdAt)}
                          </td>
                          <td className="px-4 py-4">
                            {isPending ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleBookingAction(booking.id, 'CONFIRMED')
                                  }
                                  disabled={isUpdating}
                                  className="button-success rounded-full px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {isUpdating ? 'Updating...' : 'Accept'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleBookingAction(booking.id, 'REJECTED')
                                  }
                                  disabled={isUpdating}
                                  className="button-danger-soft rounded-full px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  {isUpdating ? 'Updating...' : 'Reject'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--muted)]">
                                {booking.status === 'CONFIRMED' ||
                                booking.status === 'IN_PROGRESS'
                                  ? 'Already accepted'
                                  : 'No action needed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-[var(--muted)]"
                      >
                        No traveller bookings yet. New requests will appear here once someone
                        books this guide.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
