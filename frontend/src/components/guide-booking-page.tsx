'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  checkGuideAvailability,
  createBooking,
  type Guide,
  type GuideAvailabilityCheck,
  type UserRole,
} from '@/lib/api';
import { getStoredSession } from '@/lib/auth';

type GuideBookingPageProps = {
  citySlug?: string;
  guide: Guide;
  returnPath: string;
};

type BookingFormState = {
  startAt: string;
  endAt: string;
  guestCount: string;
  meetingPoint: string;
  message: string;
};

function formatDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function createDefaultBookingForm(): BookingFormState {
  const startAt = new Date();
  startAt.setDate(startAt.getDate() + 1);
  startAt.setHours(10, 0, 0, 0);

  const endAt = new Date(startAt);
  endAt.setHours(endAt.getHours() + 4);

  return {
    startAt: formatDateTimeLocalValue(startAt),
    endAt: formatDateTimeLocalValue(endAt),
    guestCount: '1',
    meetingPoint: '',
    message: '',
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function parseDateTimeInput(value: string, label: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return date;
}

export function GuideBookingPage({
  citySlug,
  guide,
  returnPath,
}: GuideBookingPageProps) {
  const router = useRouter();
  const [viewerRole, setViewerRole] = useState<UserRole | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [bookingForm, setBookingForm] = useState<BookingFormState>(
    createDefaultBookingForm(),
  );
  const [availability, setAvailability] =
    useState<GuideAvailabilityCheck | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    setIsLoggedIn(Boolean(session));
    setViewerRole(session?.user.role ?? null);
  }, []);

  const canBook = viewerRole === 'USER' || viewerRole === 'TOURIST';
  const durationHours = (() => {
    try {
      const startAt = parseDateTimeInput(bookingForm.startAt, 'Start time');
      const endAt = parseDateTimeInput(bookingForm.endAt, 'End time');

      if (endAt <= startAt) {
        return 0;
      }

      return Math.max(
        1,
        Math.ceil((endAt.getTime() - startAt.getTime()) / (60 * 60 * 1000)),
      );
    } catch {
      return 0;
    }
  })();
  const estimatedTotal =
    guide.hourlyRate && durationHours > 0
      ? guide.hourlyRate * durationHours
      : null;

  function updateField<Key extends keyof BookingFormState>(
    key: Key,
    value: BookingFormState[Key],
  ) {
    setBookingForm((current) => ({
      ...current,
      [key]: value,
    }));
    setAvailability(null);
    setAvailabilityError(null);
    setBookingError(null);
    setBookingSuccess(null);
  }

  async function handleCheckAvailability() {
    let startAtIso = '';
    let endAtIso = '';

    try {
      const startAt = parseDateTimeInput(bookingForm.startAt, 'Start time');
      const endAt = parseDateTimeInput(bookingForm.endAt, 'End time');

      if (endAt <= startAt) {
        throw new Error('End time must be after start time.');
      }

      startAtIso = startAt.toISOString();
      endAtIso = endAt.toISOString();
    } catch (checkError) {
      setAvailability(null);
      setAvailabilityError(
        checkError instanceof Error
          ? checkError.message
          : 'Enter a valid slot before checking availability.',
      );
      return;
    }

    setIsCheckingAvailability(true);
    setAvailability(null);
    setAvailabilityError(null);

    try {
      const nextAvailability = await checkGuideAvailability(
        guide.id,
        startAtIso,
        endAtIso,
      );

      setAvailability(nextAvailability);
    } catch (checkError) {
      setAvailabilityError(
        checkError instanceof Error
          ? checkError.message
          : 'Unable to check guide availability.',
      );
    } finally {
      setIsCheckingAvailability(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const session = getStoredSession();

    if (!session) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }

    if (session.user.role !== 'USER' && session.user.role !== 'TOURIST') {
      setBookingError('Only traveller accounts can create bookings.');
      return;
    }

    const guestCount = Number(bookingForm.guestCount);

    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 20) {
      setBookingError('Guest count must be between 1 and 20.');
      return;
    }

    let startAtIso = '';
    let endAtIso = '';

    try {
      const startAt = parseDateTimeInput(bookingForm.startAt, 'Start time');
      const endAt = parseDateTimeInput(bookingForm.endAt, 'End time');

      if (endAt <= startAt) {
        throw new Error('End time must be after start time.');
      }

      startAtIso = startAt.toISOString();
      endAtIso = endAt.toISOString();
    } catch (submitError) {
      setBookingError(
        submitError instanceof Error
          ? submitError.message
          : 'Enter a valid slot before booking.',
      );
      return;
    }

    setIsBooking(true);
    setBookingError(null);
    setBookingSuccess(null);

    try {
      await createBooking(session.accessToken, {
        guideProfileId: guide.id,
        startAt: startAtIso,
        endAt: endAtIso,
        guestCount,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        meetingPoint: bookingForm.meetingPoint.trim() || undefined,
        message: bookingForm.message.trim() || undefined,
      });

      setBookingSuccess(
        `Booking request sent to ${guide.user.fullName}. The guide will confirm it from their dashboard.`,
      );
      setBookingForm(createDefaultBookingForm());
      setAvailability(null);
    } catch (submitError) {
      setBookingError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to create the booking right now.',
      );
    } finally {
      setIsBooking(false);
    }
  }

  return (
    <main className="pb-16 pt-8">
      <div className="page-shell space-y-8">
        <header className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-[32px] px-5 py-3">
          <Link href="/" className="font-mono text-sm uppercase tracking-[0.2em]">
            Ghoomo
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
            <Link href={citySlug ? `/cities/${citySlug}` : '/'}>Back</Link>
            {!isLoggedIn ? (
              <>
                <Link href={`/login?next=${encodeURIComponent(returnPath)}`}>Login</Link>
                <Link href="/register">Register</Link>
              </>
            ) : null}
          </div>
        </header>

        <section className="glass-panel rounded-[36px] p-8 md:p-10">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="eyebrow">Booking request</p>
              <h1 className="section-title mt-4 text-[2.6rem]">
                Book {guide.user.fullName}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
                Review the guide availability below, choose a slot, and send your
                request.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="panel-tint rounded-[22px] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    City
                  </p>
                  <p className="mt-2 text-lg font-semibold">{guide.city}</p>
                </div>
                <div className="panel-tint rounded-[22px] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Rate
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {guide.hourlyRate ? `INR ${guide.hourlyRate}/hr` : 'On request'}
                  </p>
                </div>
                <div className="panel-tint rounded-[22px] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Status
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {guide.isAvailable ? 'Accepting bookings' : 'Unavailable'}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-[var(--line)] bg-[var(--surface-pill)] p-5">
                <p className="text-base font-semibold">Guide summary</p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {guide.bio ?? 'This guide has not added a bio yet.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {guide.languages.map((language) => (
                    <span
                      key={language}
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium"
                    >
                      {language}
                    </span>
                  ))}
                  {guide.specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="tag-soft rounded-full px-3 py-1 text-xs font-medium"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <article className="panel-tint rounded-[28px] p-6">
                <p className="eyebrow">Availability</p>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                  Guides can pause bookings completely or block specific dates and
                  time ranges.
                </p>

                {guide.availabilityBlocks && guide.availabilityBlocks.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {guide.availabilityBlocks.map((block) => (
                      <div
                        key={block.id}
                        className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-pill)] p-4"
                      >
                        <p className="text-sm font-semibold">
                          {formatDateTime(block.startAt)} to {formatDateTime(block.endAt)}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {block.reason ?? 'Blocked by guide'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[22px] border border-[var(--line)] bg-[var(--surface-pill)] px-4 py-3 text-sm text-[var(--muted)]">
                    No upcoming blocked slots published by this guide.
                  </div>
                )}
              </article>

              <article className="panel-tint rounded-[28px] p-6">
                <p className="eyebrow">Booking estimate</p>
                <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
                  <p>
                    <span className="font-semibold text-[var(--foreground)]">Duration:</span>{' '}
                    {durationHours > 0 ? `${durationHours} hour${durationHours > 1 ? 's' : ''}` : 'Select a valid slot'}
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--foreground)]">Estimated total:</span>{' '}
                    {estimatedTotal ? `INR ${estimatedTotal}` : 'Will be decided with the guide'}
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--foreground)]">Rating:</span>{' '}
                    {guide.averageRating ? `${guide.averageRating} / 5` : 'Fresh profile'}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[36px] p-8 md:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Request form</p>
              <h2 className="section-title mt-4 text-[2.4rem]">
                Pick your slot
              </h2>
            </div>
          </div>

          {!isLoggedIn ? (
            <div className="mt-6 rounded-[28px] border border-[var(--line)] bg-[var(--surface-pill)] p-6">
              <p className="text-base font-semibold">Login to continue</p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Traveller accounts can review availability and send a booking
                request from this page.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/login?next=${encodeURIComponent(returnPath)}`}
                  className="button-primary rounded-full px-5 py-3 text-sm font-semibold"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="button-secondary rounded-full px-5 py-3 text-sm font-semibold"
                >
                  Register
                </Link>
              </div>
            </div>
          ) : !canBook ? (
            <div className="message-error mt-6 rounded-2xl px-4 py-3 text-sm">
              Only traveller accounts can create guide bookings.
            </div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Start</span>
                  <input
                    type="datetime-local"
                    value={bookingForm.startAt}
                    onChange={(event) => updateField('startAt', event.target.value)}
                    className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">End</span>
                  <input
                    type="datetime-local"
                    value={bookingForm.endAt}
                    onChange={(event) => updateField('endAt', event.target.value)}
                    className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Guests</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={bookingForm.guestCount}
                    onChange={(event) => updateField('guestCount', event.target.value)}
                    className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium">Meeting point</span>
                  <input
                    type="text"
                    value={bookingForm.meetingPoint}
                    onChange={(event) => updateField('meetingPoint', event.target.value)}
                    className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                    placeholder="Hotel lobby, station gate, cafe..."
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">Trip notes</span>
                <textarea
                  value={bookingForm.message}
                  onChange={(event) => updateField('message', event.target.value)}
                  className="field-control min-h-28 w-full rounded-2xl px-4 py-3 outline-none"
                  placeholder="Places you want to cover, preferred language, or pickup details."
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCheckAvailability()}
                  disabled={isCheckingAvailability || !guide.isAvailable}
                  className="button-secondary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isCheckingAvailability ? 'Checking...' : 'Check availability'}
                </button>
                <button
                  type="submit"
                  disabled={isBooking || !guide.isAvailable}
                  className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isBooking ? 'Sending request...' : 'Book guide'}
                </button>
              </div>

              {availability ? (
                <div
                  className={
                    availability.isAvailable
                      ? 'message-success rounded-2xl px-4 py-3 text-sm'
                      : 'message-error rounded-2xl px-4 py-3 text-sm'
                  }
                >
                  {availability.isAvailable
                    ? 'This slot is currently available.'
                    : availability.reason ?? 'This slot is not available.'}
                </div>
              ) : null}

              {availabilityError ? (
                <div className="message-error rounded-2xl px-4 py-3 text-sm">
                  {availabilityError}
                </div>
              ) : null}

              {bookingSuccess ? (
                <div className="message-success rounded-2xl px-4 py-3 text-sm">
                  {bookingSuccess}
                </div>
              ) : null}

              {bookingError ? (
                <div className="message-error rounded-2xl px-4 py-3 text-sm">
                  {bookingError}
                </div>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
