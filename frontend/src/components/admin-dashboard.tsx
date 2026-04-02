'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  getMyBookings,
  createCity,
  getAdminUsers,
  getCitiesForAdmin,
  getCurrentUser,
  getHealthStatus,
  updateGuideVerification,
  type AdminUserRecord,
  type AuthUser,
  type Booking,
  type BookingStatus,
  type City,
  type HealthStatus,
  type PaymentStatus,
  type UserRole,
} from '@/lib/api';
import { clearSession, getStoredSession } from '@/lib/auth';

type DashboardState = {
  user: AuthUser | null;
  health: HealthStatus | null;
  allAccounts: AdminUserRecord[];
  bookings: Booking[];
  cities: City[];
  isLoading: boolean;
  actionGuideId: string | null;
  error: string | null;
};

type DashboardView = 'cities' | 'guides' | 'bookings';
type GuideStatusFilter = 'ALL' | NonNullable<AdminUserRecord['guideProfile']>['verificationStatus'];
type GuideRoleFilter = 'ALL' | 'USER' | 'GUIDE' | 'ADMIN';
type BookingStatusFilter = 'ALL' | BookingStatus;

type CityFormState = {
  name: string;
  summary: string;
  imageDataUrl: string;
  imageName: string;
  isActive: boolean;
  places: CityPlaceFormState[];
};

type CityPlaceFormState = {
  name: string;
  summary: string;
  imageDataUrl: string;
  imageName: string;
};

function createEmptyPlaceForm(): CityPlaceFormState {
  return {
    name: '',
    summary: '',
    imageDataUrl: '',
    imageName: '',
  };
}

function createInitialCityForm(): CityFormState {
  return {
    name: '',
    summary: '',
    imageDataUrl: '',
    imageName: '',
    isActive: true,
    places: [createEmptyPlaceForm()],
  };
}

function toCityImageSrc(city: City) {
  return `data:${city.imageMimeType};base64,${city.imageBase64}`;
}

function toGuideDocumentImageSrc(base64: string, mimeType: string) {
  return `data:${mimeType};base64,${base64}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Unable to read image.'));
    };

    reader.onerror = () => reject(new Error('Unable to read image.'));
    reader.readAsDataURL(file);
  });
}

function formatSubmittedDate(value?: string) {
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

function formatCurrency(amount: number | null) {
  return amount == null
    ? 'Quoted later'
    : `INR ${amount.toLocaleString('en-IN')}`;
}

function formatUserRoleLabel(role: UserRole) {
  return role === 'TOURIST' ? 'USER' : role;
}

function formatBookingStatusLabel(status: BookingStatus) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const GUIDE_ROLE_OPTIONS: GuideRoleFilter[] = ['USER', 'GUIDE', 'ADMIN'];

function ViewToggleButton({
  isActive,
  onClick,
  label,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        isActive
          ? 'button-primary rounded-full px-4 py-2 text-sm font-semibold'
          : 'button-secondary rounded-full px-4 py-2 text-sm font-semibold'
      }
    >
      {label}
    </button>
  );
}

function GuideStatusBadge({
  status,
}: {
  status: NonNullable<AdminUserRecord['guideProfile']>['verificationStatus'];
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

function AccountDetailPanel({
  account,
  isBusy,
  onVerification,
}: {
  account: AdminUserRecord | null;
  isBusy: boolean;
  onVerification: (guideId: string, status: 'APPROVED' | 'REJECTED') => void;
}) {
  if (!account) {
    return (
      <div className="panel-tint rounded-[28px] p-6 text-[var(--muted)]">
        Select an account from the table to inspect details.
      </div>
    );
  }

  const guide = account.guideProfile;
  const kyc = guide?.kyc ?? {
    aadhaarNumber: null,
    panNumber: null,
    aadhaarImageBase64: null,
    aadhaarImageMimeType: null,
    panImageBase64: null,
    panImageMimeType: null,
    passportPhotoBase64: null,
    passportPhotoMimeType: null,
  };
  const hasAadhaarImage = Boolean(
    kyc.aadhaarImageBase64 && kyc.aadhaarImageMimeType,
  );
  const hasPanImage = Boolean(
    kyc.panImageBase64 && kyc.panImageMimeType,
  );
  const hasPassportPhoto = Boolean(
    kyc.passportPhotoBase64 && kyc.passportPhotoMimeType,
  );

  return (
    <article className="panel-tint rounded-[28px] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">
            {guide ? guide.city : formatUserRoleLabel(account.role)}
          </p>
          <h3 className="mt-1 text-2xl font-semibold">{account.fullName}</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{account.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="tag-soft rounded-full px-3 py-1 text-xs font-semibold">
            {formatUserRoleLabel(account.role)}
          </span>
          {guide ? <GuideStatusBadge status={guide.verificationStatus} /> : null}
          {guide ? (
            <>
              <button
                type="button"
                disabled={isBusy || guide.verificationStatus === 'APPROVED'}
                onClick={() => onVerification(guide.id, 'APPROVED')}
                className="button-success rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBusy ? 'Updating...' : 'Approve'}
              </button>
              <button
                type="button"
                disabled={isBusy || guide.verificationStatus === 'REJECTED'}
                onClick={() => onVerification(guide.id, 'REJECTED')}
                className="button-danger-soft rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBusy ? 'Updating...' : 'Reject'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="panel-tint-strong rounded-[22px] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Role
          </p>
          <p className="mt-2 text-lg font-semibold">{formatUserRoleLabel(account.role)}</p>
        </div>
        <div className="panel-tint-strong rounded-[22px] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Joined
          </p>
          <p className="mt-2 text-lg font-semibold">
            {formatSubmittedDate(account.createdAt)}
          </p>
        </div>
        <div className="panel-tint-strong rounded-[22px] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Phone
          </p>
          <p className="mt-2 text-lg font-semibold">{account.phone ?? 'Not provided'}</p>
        </div>
        <div className="panel-tint-strong rounded-[22px] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Updated
          </p>
          <p className="mt-2 text-lg font-semibold">
            {formatSubmittedDate(account.updatedAt)}
          </p>
        </div>
      </div>

      {guide ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="panel-tint-strong rounded-[22px] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                Rate
              </p>
              <p className="mt-2 text-lg font-semibold">
                {guide.hourlyRate ? `INR ${guide.hourlyRate}/hr` : 'Rate not provided'}
              </p>
            </div>
            <div className="panel-tint-strong rounded-[22px] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                Guide submitted
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatSubmittedDate(guide.createdAt)}
              </p>
            </div>
            <div className="panel-tint-strong rounded-[22px] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                Reviews
              </p>
              <p className="mt-2 text-lg font-semibold">{guide.reviewCount}</p>
            </div>
            <div className="panel-tint-strong rounded-[22px] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                Rating
              </p>
              <p className="mt-2 text-lg font-semibold">
                {guide.averageRating ? `${guide.averageRating} / 5` : 'No rating'}
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-7 text-[var(--muted)]">
            {guide.bio ?? 'No bio provided.'}
          </p>

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

          <div className="mt-4 flex flex-wrap gap-2">
            {guide.specialties.map((specialty) => (
              <span
                key={specialty}
                className="tag-soft rounded-full px-3 py-1 text-xs font-medium"
              >
                {specialty}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
            <div className="contrast-panel rounded-[24px] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--contrast-muted)]">
                Passport photo
              </p>
              {hasPassportPhoto ? (
                <>
                  <div className="relative mt-4 overflow-hidden rounded-[20px]">
                    <Image
                      src={toGuideDocumentImageSrc(
                        kyc.passportPhotoBase64!,
                        kyc.passportPhotoMimeType!,
                      )}
                      alt={`${account.fullName} passport photo`}
                      width={600}
                      height={800}
                      className="h-60 w-full object-cover"
                      unoptimized
                    />
                  </div>
                  <p className="mt-3 text-sm text-[var(--contrast-muted)]">
                    Uploaded for identity verification.
                  </p>
                </>
              ) : (
                <p className="mt-4 text-sm text-[var(--contrast-muted)]">
                  Passport photo not submitted yet.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="panel-tint-strong rounded-[24px] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Aadhaar
                </p>
                <p className="mt-3 text-lg font-semibold">
                  {kyc.aadhaarNumber ?? 'Not submitted'}
                </p>
                {hasAadhaarImage ? (
                  <div className="relative mt-4 overflow-hidden rounded-[20px]">
                    <Image
                      src={toGuideDocumentImageSrc(
                        kyc.aadhaarImageBase64!,
                        kyc.aadhaarImageMimeType!,
                      )}
                      alt={`${account.fullName} Aadhaar card`}
                      width={1200}
                      height={800}
                      className="h-48 w-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    Aadhaar image not submitted.
                  </p>
                )}
              </div>

              <div className="panel-tint-strong rounded-[24px] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  PAN
                </p>
                <p className="mt-3 text-lg font-semibold">
                  {kyc.panNumber ?? 'Not submitted'}
                </p>
                {hasPanImage ? (
                  <div className="relative mt-4 overflow-hidden rounded-[20px]">
                    <Image
                      src={toGuideDocumentImageSrc(
                        kyc.panImageBase64!,
                        kyc.panImageMimeType!,
                      )}
                      alt={`${account.fullName} PAN card`}
                      width={1200}
                      height={800}
                      className="h-48 w-full object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--muted)]">
                    PAN image not submitted.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="panel-tint-strong mt-6 rounded-[24px] p-4 text-sm text-[var(--muted)]">
          This account does not have a guide profile, so there are no guide verification
          actions or travel profile details to review.
        </div>
      )}
    </article>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({
    user: null,
    health: null,
    allAccounts: [],
    bookings: [],
    cities: [],
    isLoading: true,
    actionGuideId: null,
    error: null,
  });
  const [cityForm, setCityForm] = useState<CityFormState>(createInitialCityForm);
  const [isSavingCity, setIsSavingCity] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>('cities');
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [guideCityFilter, setGuideCityFilter] = useState('ALL');
  const [guideStatusFilter, setGuideStatusFilter] =
    useState<GuideStatusFilter>('ALL');
  const [guideRoleFilter, setGuideRoleFilter] =
    useState<GuideRoleFilter>('ALL');
  const [bookingCityFilter, setBookingCityFilter] = useState('ALL');
  const [bookingStatusFilter, setBookingStatusFilter] =
    useState<BookingStatusFilter>('ALL');

  async function loadDashboard(token: string) {
    const [user, health, allAccounts, cities, bookings] = await Promise.all([
      getCurrentUser(token),
      getHealthStatus(),
      getAdminUsers(token),
      getCitiesForAdmin(token),
      getMyBookings(token),
    ]);

    return {
      user,
      health,
      allAccounts,
      bookings,
      cities,
    };
  }

  useEffect(() => {
    let isActive = true;

    async function load() {
      const session = getStoredSession();

      if (!session || session.user.role !== 'ADMIN') {
        router.replace('/login?next=/admin');
        return;
      }

      try {
        const dashboard = await loadDashboard(session.accessToken);

        if (!isActive) {
          return;
        }

        if (dashboard.user.role !== 'ADMIN') {
          clearSession();
          router.replace('/login?next=/admin');
          return;
        }

        setState((current) => ({
          ...current,
          ...dashboard,
          isLoading: false,
          error: null,
        }));
      } catch {
        clearSession();
        if (isActive) {
          router.replace('/login?next=/admin');
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [router]);

  function updateCityField<Key extends keyof CityFormState>(
    key: Key,
    value: CityFormState[Key],
  ) {
    setCityForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updatePlaceField<Key extends keyof CityPlaceFormState>(
    index: number,
    key: Key,
    value: CityPlaceFormState[Key],
  ) {
    setCityForm((current) => ({
      ...current,
      places: current.places.map((place, placeIndex) =>
        placeIndex === index
          ? {
              ...place,
              [key]: value,
            }
          : place,
      ),
    }));
  }

  function addPlaceField() {
    setCityForm((current) => ({
      ...current,
      places: [...current.places, createEmptyPlaceForm()],
    }));
  }

  function removePlaceField(index: number) {
    setCityForm((current) => ({
      ...current,
      places:
        current.places.length === 1
          ? [createEmptyPlaceForm()]
          : current.places.filter((_, placeIndex) => placeIndex !== index),
    }));
  }

  async function handleCityImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setCityForm((current) => ({
        ...current,
        imageDataUrl: '',
        imageName: '',
      }));
      return;
    }

    if (!file.type.startsWith('image/')) {
      setState((current) => ({
        ...current,
        error: 'Upload a valid image file.',
      }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setState((current) => ({
        ...current,
        error: 'Keep city images under 2 MB for now.',
      }));
      return;
    }

    try {
      const imageDataUrl = await readFileAsDataUrl(file);

      setCityForm((current) => ({
        ...current,
        imageDataUrl,
        imageName: file.name,
      }));
      setState((current) => ({
        ...current,
        error: null,
      }));
    } catch (imageError) {
      setState((current) => ({
        ...current,
        error:
          imageError instanceof Error
            ? imageError.message
            : 'Unable to read city image.',
      }));
    }
  }

  async function handlePlaceImageChange(
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      updatePlaceField(index, 'imageDataUrl', '');
      updatePlaceField(index, 'imageName', '');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setState((current) => ({
        ...current,
        error: 'Upload a valid place image file.',
      }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setState((current) => ({
        ...current,
        error: 'Keep place images under 2 MB for now.',
      }));
      return;
    }

    try {
      const imageDataUrl = await readFileAsDataUrl(file);

      setCityForm((current) => ({
        ...current,
        places: current.places.map((place, placeIndex) =>
          placeIndex === index
            ? {
                ...place,
                imageDataUrl,
                imageName: file.name,
              }
            : place,
        ),
      }));
      setState((current) => ({
        ...current,
        error: null,
      }));
    } catch (imageError) {
      setState((current) => ({
        ...current,
        error:
          imageError instanceof Error
            ? imageError.message
            : 'Unable to read place image.',
      }));
    }
  }

  async function handleCreateCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    const session = getStoredSession();

    if (!session) {
      router.replace('/login?next=/admin');
      return;
    }

    const separatorIndex = cityForm.imageDataUrl.indexOf(',');

    if (separatorIndex === -1) {
      setState((current) => ({
        ...current,
        error: 'Select a city image before saving.',
      }));
      return;
    }

    const header = cityForm.imageDataUrl.slice(0, separatorIndex);
    const imageBase64 = cityForm.imageDataUrl.slice(separatorIndex + 1);
    const mimeMatch = header.match(/^data:(.+);base64$/);

    if (!mimeMatch) {
      setState((current) => ({
        ...current,
        error: 'City image format is invalid.',
      }));
      return;
    }

    const normalizedPlaces = cityForm.places.filter(
      (place) => place.name.trim() || place.summary.trim() || place.imageDataUrl,
    );

    if (!normalizedPlaces.length) {
      setState((current) => ({
        ...current,
        error: 'Add at least one place for this city.',
      }));
      return;
    }

    const places: Array<{
      name: string;
      summary?: string;
      imageBase64: string;
      imageMimeType: string;
      displayOrder: number;
    }> = [];

    for (const [index, place] of normalizedPlaces.entries()) {
      if (!place.name.trim()) {
        setState((current) => ({
          ...current,
          error: `Place ${index + 1} needs a name.`,
        }));
        return;
      }

      const placeSeparatorIndex = place.imageDataUrl.indexOf(',');

      if (placeSeparatorIndex === -1) {
        setState((current) => ({
          ...current,
          error: `Place ${index + 1} needs an image.`,
        }));
        return;
      }

      const placeHeader = place.imageDataUrl.slice(0, placeSeparatorIndex);
      const placeImageBase64 = place.imageDataUrl.slice(placeSeparatorIndex + 1);
      const placeMimeMatch = placeHeader.match(/^data:(.+);base64$/);

      if (!placeMimeMatch) {
        setState((current) => ({
          ...current,
          error: `Place ${index + 1} image format is invalid.`,
        }));
        return;
      }

      places.push({
        name: place.name.trim(),
        summary: place.summary.trim() || undefined,
        imageBase64: placeImageBase64,
        imageMimeType: placeMimeMatch[1],
        displayOrder: index,
      });
    }

    setIsSavingCity(true);
    setState((current) => ({
      ...current,
      error: null,
    }));

    try {
      await createCity(session.accessToken, {
        name: cityForm.name,
        summary: cityForm.summary || undefined,
        imageBase64,
        imageMimeType: mimeMatch[1],
        isActive: cityForm.isActive,
        places,
      });

      const cities = await getCitiesForAdmin(session.accessToken);

      setState((current) => ({
        ...current,
        cities,
      }));
      setCityForm(createInitialCityForm());
      setIsCityModalOpen(false);
      formElement.reset();
    } catch (actionError) {
      setState((current) => ({
        ...current,
        error:
          actionError instanceof Error
            ? actionError.message
            : 'Unable to save city.',
      }));
    } finally {
      setIsSavingCity(false);
    }
  }

  async function handleVerification(
    guideId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    const session = getStoredSession();

    if (!session) {
      router.replace('/login?next=/admin');
      return;
    }

    setState((current) => ({
      ...current,
      actionGuideId: guideId,
      error: null,
    }));

    try {
      await updateGuideVerification(session.accessToken, guideId, status);
      const [allAccounts, cities] = await Promise.all([
        getAdminUsers(session.accessToken),
        getCitiesForAdmin(session.accessToken),
      ]);

      setState((current) => ({
        ...current,
        allAccounts,
        cities,
        actionGuideId: null,
      }));
    } catch (actionError) {
      setState((current) => ({
        ...current,
        actionGuideId: null,
        error:
          actionError instanceof Error
            ? actionError.message
            : 'Unable to update guide verification.',
      }));
    }
  }

  function handleLogout() {
    clearSession();
    router.replace('/login');
    router.refresh();
  }

  const liveCities = state.cities.filter((city) => city.isActive).length;
  const pendingGuides = state.allAccounts.filter(
    (account) => account.guideProfile?.verificationStatus === 'PENDING',
  );
  const approvedGuides = state.allAccounts.filter(
    (account) => account.guideProfile?.verificationStatus === 'APPROVED',
  );
  const totalBookings = state.bookings.length;
  const pendingBookings = state.bookings.filter(
    (booking) => booking.status === 'PENDING',
  );
  const guideCities = Array.from(
    new Set(
      state.allAccounts
        .map((account) => account.guideProfile?.city)
        .filter((city): city is string => Boolean(city)),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const filteredAccounts = state.allAccounts.filter((account) => {
    const matchesCity =
      guideCityFilter === 'ALL' || account.guideProfile?.city === guideCityFilter;
    const matchesStatus =
      guideStatusFilter === 'ALL' ||
      account.guideProfile?.verificationStatus === guideStatusFilter;
    const matchesRole =
      guideRoleFilter === 'ALL'
        ? true
        : guideRoleFilter === 'USER'
          ? account.role === 'USER' || account.role === 'TOURIST'
          : account.role === guideRoleFilter;

    return matchesCity && matchesStatus && matchesRole;
  });
  const hasActiveGuideFilters =
    guideCityFilter !== 'ALL' ||
    guideStatusFilter !== 'ALL' ||
    guideRoleFilter !== 'ALL';
  const selectedAccount =
    filteredAccounts.find((account) => account.id === selectedGuideId) ?? null;
  const bookingCities = Array.from(
    new Set(state.bookings.map((booking) => booking.guide.city).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
  const filteredBookings = state.bookings.filter((booking) => {
    const matchesCity =
      bookingCityFilter === 'ALL' || booking.guide.city === bookingCityFilter;
    const matchesStatus =
      bookingStatusFilter === 'ALL' || booking.status === bookingStatusFilter;

    return matchesCity && matchesStatus;
  });
  const hasActiveBookingFilters =
    bookingCityFilter !== 'ALL' || bookingStatusFilter !== 'ALL';

  useEffect(() => {
    setSelectedGuideId((current) => {
      if (!filteredAccounts.length) {
        return null;
      }

      if (current && filteredAccounts.some((account) => account.id === current)) {
        return current;
      }

      return filteredAccounts[0].id;
    });
  }, [filteredAccounts]);

  if (state.isLoading) {
    return (
      <div className="glass-panel rounded-[36px] p-8 md:p-10">
        <p className="eyebrow">Admin access</p>
        <h1 className="section-title mt-4 text-[2.4rem]">Checking your session</h1>
        <p className="mt-4 text-base text-[var(--muted)]">
          Verifying admin credentials with the backend.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <section className="glass-panel rounded-[36px] p-8 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Admin dashboard</p>
              <h1 className="section-title mt-4 text-[2.5rem]">
                Welcome, {state.user?.fullName}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
                Switch between city management and guide review from one compact dashboard.
                City creation now lives in a modal so the listing area stays focused.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <article className="glass-panel rounded-[28px] p-6">
            <p className="text-sm text-[var(--muted)]">Role</p>
            <p className="mt-2 text-2xl font-semibold">{state.user?.role}</p>
          </article>
          <article className="glass-panel rounded-[28px] p-6">
            <p className="text-sm text-[var(--muted)]">Pending guides</p>
            <p className="mt-2 text-2xl font-semibold">{pendingGuides.length}</p>
          </article>
          <article className="glass-panel rounded-[28px] p-6">
            <p className="text-sm text-[var(--muted)]">Approved guides</p>
            <p className="mt-2 text-2xl font-semibold">{approvedGuides.length}</p>
          </article>
          <article className="glass-panel rounded-[28px] p-6">
            <p className="text-sm text-[var(--muted)]">Live cities</p>
            <p className="mt-2 text-2xl font-semibold">{liveCities}</p>
          </article>
          <article className="glass-panel rounded-[28px] p-6">
            <p className="text-sm text-[var(--muted)]">Total bookings</p>
            <p className="mt-2 text-2xl font-semibold">{totalBookings}</p>
          </article>
        </section>

        {state.error ? (
          <div className="message-error rounded-2xl px-4 py-3 text-sm">
            {state.error}
          </div>
        ) : null}

        <section className="glass-panel rounded-[36px] p-8 md:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">
                {activeView === 'cities'
                  ? 'Homepage cities'
                  : activeView === 'guides'
                    ? 'Account directory'
                    : 'Guide bookings'}
              </p>
              <h2 className="section-title mt-4 text-[2.2rem]">
                {activeView === 'cities'
                  ? 'Configured city cards'
                  : activeView === 'guides'
                    ? 'All accounts in one table'
                    : 'Every booking across all guides'}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ViewToggleButton
                isActive={activeView === 'cities'}
                onClick={() => setActiveView('cities')}
                label="Cities"
              />
              <ViewToggleButton
                isActive={activeView === 'guides'}
                onClick={() => setActiveView('guides')}
                label="Guides"
              />
              <ViewToggleButton
                isActive={activeView === 'bookings'}
                onClick={() => setActiveView('bookings')}
                label="Bookings"
              />
              <button
                type="button"
                onClick={() => {
                  setActiveView('cities');
                  setIsCityModalOpen(true);
                }}
                className="button-primary rounded-full px-4 py-2 text-sm font-semibold"
              >
                Add city
              </button>
            </div>
          </div>

          {activeView === 'cities' ? (
            <>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-[var(--line)] px-5 py-4">
                <div>
                  <p className="text-sm font-semibold">City cards stay visible here</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Open the modal only when you need to create a new city or add places.
                  </p>
                </div>
                <div className="panel-tint rounded-[24px] px-4 py-3 text-sm">
                  Images are stored in Postgres as base64 and rendered directly on the site.
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {state.cities.length > 0 ? (
                  state.cities.map((city) => (
                    <Link
                      key={city.id}
                      href={`/cities/${city.slug}`}
                      className="group block"
                    >
                      <article className="panel-tint-strong overflow-hidden rounded-[28px] transition-transform duration-200 group-hover:-translate-y-1">
                        <div className="relative">
                          <Image
                            src={toCityImageSrc(city)}
                            alt={`${city.name} preview`}
                            width={900}
                            height={700}
                            className="h-44 w-full object-cover"
                            unoptimized
                          />
                          <div className="contrast-panel absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold shadow-none">
                            {city.isActive ? 'Live on home' : 'Saved only'}
                          </div>
                        </div>

                        <div className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <h3 className="text-2xl font-semibold">{city.name}</h3>
                              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                                {city.summary ?? 'No summary added yet.'}
                              </p>
                            </div>
                            <span className="tag-soft rounded-full px-3 py-1 text-xs font-semibold">
                              {city.guideCount} {city.guideCount === 1 ? 'guide' : 'guides'}
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
                            <span>
                              {city.startingRate
                                ? `Starting from INR ${city.startingRate}/hr`
                                : 'No approved guide pricing yet'}
                            </span>
                            <div className="flex flex-wrap items-center gap-3">
                              <span>
                                {city.placeCount} {city.placeCount === 1 ? 'place' : 'places'}
                              </span>
                              <span className="button-secondary rounded-full px-3 py-1 text-xs font-semibold">
                                Open city page
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))
                ) : (
                  <div className="panel-tint rounded-[28px] p-6 text-[var(--muted)] lg:col-span-2">
                    No homepage cities saved yet. Use the `Add city` button to create the
                    first one.
                  </div>
                )}
              </div>
            </>
          ) : activeView === 'guides' ? (
            <div className="mt-6 space-y-6">
              <div className="panel-tint rounded-[30px] p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Account filters</p>
                    <h3 className="mt-3 text-xl font-semibold">
                      Narrow the account table quickly
                    </h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Show all admin, guide, and user records from one compact toolbar.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="contrast-panel rounded-[22px] px-4 py-3 text-sm shadow-none">
                      {filteredAccounts.length}{' '}
                      {filteredAccounts.length === 1 ? 'record' : 'records'} shown
                    </div>
                    <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-pill)] px-4 py-3 text-sm text-[var(--muted)]">
                      API:{' '}
                      {state.health
                        ? `${state.health.status} / db ${state.health.database}`
                        : 'Unavailable'}
                    </div>
                  </div>
                </div>

                <div className="panel-tint-strong mt-5 rounded-[24px] p-4">
                  <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        City
                      </span>
                      <select
                        value={guideCityFilter}
                        onChange={(event) => setGuideCityFilter(event.target.value)}
                        className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                      >
                        <option value="ALL">All cities</option>
                        {guideCities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Status
                      </span>
                      <select
                        value={guideStatusFilter}
                        onChange={(event) =>
                          setGuideStatusFilter(event.target.value as GuideStatusFilter)
                        }
                        className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                      >
                        <option value="ALL">All statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Role
                      </span>
                      <select
                        value={guideRoleFilter}
                      onChange={(event) =>
                        setGuideRoleFilter(event.target.value as GuideRoleFilter)
                      }
                      className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                    >
                      <option value="ALL">All records</option>
                      {GUIDE_ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setGuideCityFilter('ALL');
                        setGuideStatusFilter('ALL');
                        setGuideRoleFilter('ALL');
                      }}
                      disabled={!hasActiveGuideFilters}
                      className="button-secondary w-full rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 xl:min-w-[160px]"
                    >
                      Clear filters
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-[var(--muted)]">Active:</span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1.5">
                    City: {guideCityFilter === 'ALL' ? 'All cities' : guideCityFilter}
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1.5">
                    Status:{' '}
                    {guideStatusFilter === 'ALL' ? 'All statuses' : guideStatusFilter}
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1.5">
                    Role:{' '}
                    {guideRoleFilter === 'ALL'
                      ? 'All records'
                      : guideRoleFilter}
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-[var(--line)]">
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full text-left text-sm">
                    <thead className="bg-[var(--surface-pill)] text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">User</th>
                        <th className="px-4 py-3 font-semibold">Role</th>
                        <th className="px-4 py-3 font-semibold">City</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Phone</th>
                        <th className="px-4 py-3 font-semibold">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.length > 0 ? (
                        filteredAccounts.map((account) => {
                          const isSelected = account.id === selectedGuideId;

                          return (
                            <tr
                              key={account.id}
                              onClick={() => setSelectedGuideId(account.id)}
                              className={
                                isSelected
                                  ? 'cursor-pointer border-t border-[var(--line)] bg-[var(--accent-soft)]'
                                  : 'cursor-pointer border-t border-[var(--line)] hover:bg-[var(--surface-pill)]'
                              }
                            >
                              <td className="px-4 py-4">
                                <p className="font-semibold">{account.fullName}</p>
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {account.email}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <span className="tag-soft rounded-full px-3 py-1 text-xs font-semibold">
                                  {formatUserRoleLabel(account.role)}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-[var(--muted)]">
                                {account.guideProfile?.city ?? 'Not a guide'}
                              </td>
                              <td className="px-4 py-4">
                                {account.guideProfile ? (
                                  <GuideStatusBadge
                                    status={account.guideProfile.verificationStatus}
                                  />
                                ) : (
                                  <span className="text-[var(--muted)]">No guide profile</span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-[var(--muted)]">
                                {account.phone ?? 'Not provided'}
                              </td>
                              <td className="px-4 py-4 text-[var(--muted)]">
                                {formatSubmittedDate(account.createdAt)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-[var(--muted)]"
                          >
                            No accounts match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <AccountDetailPanel
                account={selectedAccount}
                isBusy={state.actionGuideId === selectedAccount?.guideProfile?.id}
                onVerification={(guideId, status) => {
                  void handleVerification(guideId, status);
                }}
              />
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="panel-tint rounded-[30px] p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Booking overview</p>
                    <h3 className="mt-3 text-xl font-semibold">
                      Guide requests, confirmations, and completed tours
                    </h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      This table combines bookings from every guide so admin can inspect
                      volume and service status in one place.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="contrast-panel rounded-[22px] px-4 py-3 text-sm shadow-none">
                      {filteredBookings.length}{' '}
                      {filteredBookings.length === 1 ? 'booking' : 'bookings'} shown
                    </div>
                    <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-pill)] px-4 py-3 text-sm text-[var(--muted)]">
                      Pending: {pendingBookings.length}
                    </div>
                  </div>
                </div>

                <div className="panel-tint-strong mt-5 rounded-[24px] p-4">
                  <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Guide city
                      </span>
                      <select
                        value={bookingCityFilter}
                        onChange={(event) => setBookingCityFilter(event.target.value)}
                        className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                      >
                        <option value="ALL">All cities</option>
                        {bookingCities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Booking status
                      </span>
                      <select
                        value={bookingStatusFilter}
                        onChange={(event) =>
                          setBookingStatusFilter(event.target.value as BookingStatusFilter)
                        }
                        className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                      >
                        <option value="ALL">All statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="NO_SHOW">No show</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setBookingCityFilter('ALL');
                        setBookingStatusFilter('ALL');
                      }}
                      disabled={!hasActiveBookingFilters}
                      className="button-secondary w-full rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 xl:min-w-[160px]"
                    >
                      Clear filters
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-[var(--muted)]">Active:</span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1.5">
                    City: {bookingCityFilter === 'ALL' ? 'All cities' : bookingCityFilter}
                  </span>
                  <span className="rounded-full border border-[var(--line)] px-3 py-1.5">
                    Status:{' '}
                    {bookingStatusFilter === 'ALL'
                      ? 'All statuses'
                      : formatBookingStatusLabel(bookingStatusFilter)}
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-[var(--line)]">
                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] w-full text-left text-sm">
                    <thead className="bg-[var(--surface-pill)] text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Guide</th>
                        <th className="px-4 py-3 font-semibold">Traveller</th>
                        <th className="px-4 py-3 font-semibold">City</th>
                        <th className="px-4 py-3 font-semibold">Slot</th>
                        <th className="px-4 py-3 font-semibold">Guests</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Payment</th>
                        <th className="px-4 py-3 font-semibold">Total</th>
                        <th className="px-4 py-3 font-semibold">Requested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.length > 0 ? (
                        filteredBookings.map((booking) => (
                          <tr
                            key={booking.id}
                            className="border-t border-[var(--line)] align-top"
                          >
                            <td className="px-4 py-4">
                              <p className="font-semibold">{booking.guide.fullName}</p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {booking.guide.email}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-semibold">{booking.tourist.fullName}</p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {booking.tourist.email}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-[var(--muted)]">
                              {booking.guide.city}
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-medium">
                                {formatDateTime(booking.startAt)}
                              </p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                Until {formatDateTime(booking.endAt)}
                              </p>
                              {booking.meetingPoint ? (
                                <p className="mt-2 text-xs text-[var(--muted)]">
                                  Meet: {booking.meetingPoint}
                                </p>
                              ) : null}
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
                              {formatCurrency(booking.totalAmount)}
                            </td>
                            <td className="px-4 py-4 text-[var(--muted)]">
                              {formatDateTime(booking.createdAt)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-4 py-8 text-center text-[var(--muted)]"
                          >
                            No bookings match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-4 text-sm font-semibold text-[var(--accent-strong)]">
          <Link href="/">Home</Link>
          <Link href="/register">User registration</Link>
          <Link href="/guides/register">Guide registration</Link>
          <a href="http://localhost:4000/api/v1/health" target="_blank" rel="noreferrer">
            API health
          </a>
        </div>
      </div>

      {isCityModalOpen ? (
        <div className="fixed inset-0 z-50 bg-[rgba(7,11,18,0.68)] px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-5xl items-center justify-center">
            <div
              role="dialog"
              aria-modal="true"
              className="glass-panel max-h-full w-full overflow-hidden rounded-[32px] border border-[var(--line)]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5 md:px-8">
                <div>
                  <p className="eyebrow">Homepage cities</p>
                  <h2 className="section-title mt-3 text-[2rem]">Add city card with places</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCityModalOpen(false)}
                  className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
                >
                  Close
                </button>
              </div>

              <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-6 py-6 md:px-8">
                <form className="grid gap-5" onSubmit={handleCreateCity}>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">City name</span>
                    <input
                      type="text"
                      value={cityForm.name}
                      onChange={(event) => updateCityField('name', event.target.value)}
                      className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                      placeholder="Pune"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">Short summary</span>
                    <textarea
                      value={cityForm.summary}
                      onChange={(event) => updateCityField('summary', event.target.value)}
                      className="field-control min-h-28 w-full rounded-2xl px-4 py-3 outline-none"
                      placeholder="Heritage routes, local food stops, and compact walking trails."
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium">City image</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(event) => void handleCityImageChange(event)}
                      className="field-control w-full rounded-2xl px-4 py-3 text-sm"
                    />
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {cityForm.imageName || 'PNG, JPG, WEBP, or SVG up to 2 MB.'}
                    </p>
                  </label>

                  <div className="space-y-4 rounded-[24px] border border-[var(--line)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Places in this city</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Add the spots that should appear when someone opens the city card.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addPlaceField}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
                      >
                        Add place
                      </button>
                    </div>

                    <div className="grid gap-4">
                      {cityForm.places.map((place, index) => (
                        <div
                          key={`${index}-${place.imageName || place.name || 'place'}`}
                          className="panel-tint rounded-[24px] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-semibold">Place {index + 1}</p>
                            <button
                              type="button"
                              onClick={() => removePlaceField(index)}
                              className="button-secondary rounded-full px-3 py-1.5 text-xs font-semibold"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="mt-4 grid gap-4">
                            <label className="block">
                              <span className="mb-2 block text-sm font-medium">Place name</span>
                              <input
                                type="text"
                                value={place.name}
                                onChange={(event) =>
                                  updatePlaceField(index, 'name', event.target.value)
                                }
                                className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                                placeholder="Shaniwar Wada"
                              />
                            </label>

                            <label className="block">
                              <span className="mb-2 block text-sm font-medium">
                                Short place summary
                              </span>
                              <textarea
                                value={place.summary}
                                onChange={(event) =>
                                  updatePlaceField(index, 'summary', event.target.value)
                                }
                                className="field-control min-h-24 w-full rounded-2xl px-4 py-3 outline-none"
                                placeholder="Why this stop matters on the city page."
                              />
                            </label>

                            <label className="block">
                              <span className="mb-2 block text-sm font-medium">Place image</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                onChange={(event) => void handlePlaceImageChange(index, event)}
                                className="field-control w-full rounded-2xl px-4 py-3 text-sm"
                              />
                            </label>

                            {place.imageDataUrl ? (
                              <div className="contrast-panel rounded-[20px] p-3">
                                <div className="relative overflow-hidden rounded-[18px]">
                                  <Image
                                    src={place.imageDataUrl}
                                    alt={place.name || `Place ${index + 1} preview`}
                                    width={900}
                                    height={700}
                                    className="h-40 w-full object-cover"
                                    unoptimized
                                  />
                                </div>
                                <p className="mt-3 text-sm text-[var(--contrast-muted)]">
                                  Previewing {place.imageName || `place ${index + 1}`}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label className="panel-tint flex items-center gap-3 rounded-2xl px-4 py-3">
                    <input
                      type="checkbox"
                      checked={cityForm.isActive}
                      onChange={(event) => updateCityField('isActive', event.target.checked)}
                    />
                    <span className="text-sm font-medium">
                      Show this city on the homepage
                    </span>
                  </label>

                  {cityForm.imageDataUrl ? (
                    <div className="contrast-panel rounded-[24px] p-4">
                      <div className="relative overflow-hidden rounded-[20px]">
                        <Image
                          src={cityForm.imageDataUrl}
                          alt="Selected city preview"
                          width={900}
                          height={700}
                          className="h-52 w-full object-cover"
                          unoptimized
                        />
                      </div>
                      <p className="mt-3 text-sm text-[var(--contrast-muted)]">
                        Previewing {cityForm.imageName || 'selected image'}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-[var(--muted)]">
                      Save from this modal to add the city without expanding the main dashboard.
                    </p>
                    <button
                      type="submit"
                      disabled={isSavingCity}
                      className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingCity ? 'Saving city...' : 'Add city to homepage'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
