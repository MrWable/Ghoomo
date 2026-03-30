'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useEffect, useState, useTransition } from 'react';
import {
  type CityDetail,
  type CreateCityInput,
  type Guide,
  type UserRole,
  getGuidesForLoggedInCity,
  updateCityImage,
  updateCityPlaces,
} from '@/lib/api';
import { getStoredSession } from '@/lib/auth';

type CityDetailClientProps = {
  initialCity: CityDetail;
};

type EditablePlace = {
  id: string;
  name: string;
  summary: string;
  imageBase64: string;
  imageMimeType: string;
  previewSrc: string;
};

function toImageSrc(imageBase64: string, imageMimeType: string) {
  return `data:${imageMimeType};base64,${imageBase64}`;
}

function toEditablePlaces(city: CityDetail): EditablePlace[] {
  return city.places.map((place) => ({
    id: place.id,
    name: place.name,
    summary: place.summary ?? '',
    imageBase64: place.imageBase64,
    imageMimeType: place.imageMimeType,
    previewSrc: toImageSrc(place.imageBase64, place.imageMimeType),
  }));
}

function createEmptyPlace(): EditablePlace {
  return {
    id: `new-${Math.random().toString(36).slice(2, 10)}`,
    name: '',
    summary: '',
    imageBase64: '',
    imageMimeType: '',
    previewSrc: '',
  };
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

export function CityDetailClient({
  initialCity,
}: CityDetailClientProps) {
  const router = useRouter();
  const [city, setCity] = useState(initialCity);
  const [editablePlaces, setEditablePlaces] = useState<EditablePlace[]>(
    toEditablePlaces(initialCity),
  );
  const [viewerRole, setViewerRole] = useState<UserRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [cityImagePreviewSrc, setCityImagePreviewSrc] = useState<string | null>(null);
  const [cityGuides, setCityGuides] = useState<Guide[]>([]);
  const [guidesError, setGuidesError] = useState<string | null>(null);
  const [isGuidesLoading, setIsGuidesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const session = getStoredSession();
    setIsAdmin(session?.user.role === 'ADMIN');
    setIsLoggedIn(Boolean(session));
    setViewerRole(session?.user.role ?? null);

    if (!session) {
      setCityGuides([]);
      setGuidesError(null);
      setIsGuidesLoading(false);
      return;
    }

    let isActive = true;
    setIsGuidesLoading(true);
    setGuidesError(null);

    void getGuidesForLoggedInCity(session.accessToken, initialCity.name)
      .then((guides) => {
        if (!isActive) {
          return;
        }

        setCityGuides(guides);
      })
      .catch((guidesLoadError) => {
        if (!isActive) {
          return;
        }

        setGuidesError(
          guidesLoadError instanceof Error
            ? guidesLoadError.message
            : 'Unable to load guides for this city.',
        );
      })
      .finally(() => {
        if (isActive) {
          setIsGuidesLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [initialCity.name]);

  const canRequestBookings = viewerRole === 'USER' || viewerRole === 'TOURIST';

  function resetEditor(nextCity: CityDetail) {
    setEditablePlaces(toEditablePlaces(nextCity));
    setCityImagePreviewSrc(null);
    setError(null);
  }

  function updatePlace(
    id: string,
    patch: Partial<EditablePlace>,
  ) {
    setEditablePlaces((current) =>
      current.map((place) =>
        place.id === id
          ? {
            ...place,
            ...patch,
          }
          : place,
      ),
    );
  }

  function addPlace() {
    setEditablePlaces((current) => [...current, createEmptyPlace()]);
  }

  function removePlace(id: string) {
    setEditablePlaces((current) => {
      const nextPlaces = current.filter((place) => place.id !== id);
      return nextPlaces.length > 0 ? nextPlaces : [createEmptyPlace()];
    });
  }

  async function handlePlaceImageChange(
    id: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      updatePlace(id, {
        imageBase64: '',
        imageMimeType: '',
        previewSrc: '',
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Upload a valid place image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Keep place images under 2 MB for now.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const separatorIndex = dataUrl.indexOf(',');

      if (separatorIndex === -1) {
        setError('Place image format is invalid.');
        return;
      }

      const header = dataUrl.slice(0, separatorIndex);
      const imageBase64 = dataUrl.slice(separatorIndex + 1);
      const mimeMatch = header.match(/^data:(.+);base64$/);

      if (!mimeMatch) {
        setError('Place image format is invalid.');
        return;
      }

      updatePlace(id, {
        imageBase64,
        imageMimeType: mimeMatch[1],
        previewSrc: dataUrl,
      });
      setError(null);
    } catch (imageError) {
      setError(
        imageError instanceof Error
          ? imageError.message
          : 'Unable to read place image.',
      );
    }
  }

  async function handleCityHeroImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setCityImagePreviewSrc(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Upload a valid city image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Keep city images under 2 MB for now.');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCityImagePreviewSrc(dataUrl);
      setError(null);
    } catch (imageError) {
      setError(
        imageError instanceof Error
          ? imageError.message
          : 'Unable to read city image.',
      );
    }
  }

  function handleSaveCityImage() {
    const session = getStoredSession();

    if (!session || session.user.role !== 'ADMIN') {
      setError('Admin login is required to edit the city image.');
      return;
    }

    if (!cityImagePreviewSrc) {
      setError('Select a new city image before saving.');
      return;
    }

    const separatorIndex = cityImagePreviewSrc.indexOf(',');

    if (separatorIndex === -1) {
      setError('City image format is invalid.');
      return;
    }

    const header = cityImagePreviewSrc.slice(0, separatorIndex);
    const imageBase64 = cityImagePreviewSrc.slice(separatorIndex + 1);
    const mimeMatch = header.match(/^data:(.+);base64$/);

    if (!mimeMatch) {
      setError('City image format is invalid.');
      return;
    }

    startTransition(async () => {
      try {
        const nextCity = await updateCityImage(session.accessToken, city.id, {
          imageBase64,
          imageMimeType: mimeMatch[1],
        });

        setCity(nextCity);
        resetEditor(nextCity);
        router.refresh();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Unable to update city image.',
        );
      }
    });
  }

  function handleSavePlaces() {
    const session = getStoredSession();

    if (!session || session.user.role !== 'ADMIN') {
      setError('Admin login is required to edit city places.');
      return;
    }

    const normalizedPlaces = editablePlaces.filter(
      (place) =>
        place.name.trim() ||
        place.summary.trim() ||
        place.imageBase64,
    );

    if (!normalizedPlaces.length) {
      setError('Add at least one place.');
      return;
    }

    const payload: NonNullable<CreateCityInput['places']> = [];

    for (const [index, place] of normalizedPlaces.entries()) {
      if (!place.name.trim()) {
        setError(`Place ${index + 1} needs a name.`);
        return;
      }

      if (!place.imageBase64 || !place.imageMimeType) {
        setError(`Place ${index + 1} needs an image.`);
        return;
      }

      payload.push({
        name: place.name.trim(),
        summary: place.summary.trim() || undefined,
        imageBase64: place.imageBase64,
        imageMimeType: place.imageMimeType,
        displayOrder: index,
      });
    }

    startTransition(async () => {
      try {
        const nextCity = await updateCityPlaces(
          session.accessToken,
          city.id,
          payload,
        );

        setCity(nextCity);
        resetEditor(nextCity);
        setIsEditing(false);
        router.refresh();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : 'Unable to update places.',
        );
      }
    });
  }

  return (
    <main className="pb-18 pt-6">
      <div className="page-shell space-y-8">
        <header className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-[32px] px-5 py-3">
          <Link href="/" className="font-mono text-sm uppercase tracking-[0.2em]">
            Ghoomo
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
            <Link href="/">Home</Link>
            {isLoggedIn ? null : (
              <>
                <Link href="/register">Register</Link>
                <Link href="/login">Login</Link>
                <Link href="/guides/register">Become a guide</Link>
              </>
            )}
          </div>
        </header>

        <section className="hero-shell relative overflow-hidden rounded-[44px] px-6 py-6 md:px-8 md:py-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div>
              <p className="eyebrow">City route</p>
              <h1 className="section-title mt-4">{city.name}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
                {city.summary ??
                  `${city.name} is live on Ghoomo with curated stops saved by the admin team.`}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <div className="glass-panel rounded-[22px] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Places
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{city.placeCount}</p>
                </div>
                <div className="glass-panel rounded-[22px] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Access
                  </p>
                  <p className="mt-2 text-2xl font-semibold">Login first</p>
                </div>
                <div className="glass-panel rounded-[22px] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    Starting rate
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {city.startingRate ? `INR ${city.startingRate}` : 'TBD'}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-panel overflow-hidden rounded-[32px] p-4">
              <Image
                src={
                  cityImagePreviewSrc ??
                  toImageSrc(city.imageBase64, city.imageMimeType)
                }
                alt={`${city.name} hero image`}
                width={1200}
                height={900}
                className="h-full w-full rounded-[24px] object-cover"
                unoptimized
                priority
              />
              {isAdmin ? (
                <div className="mt-4 rounded-[24px] border border-[var(--line)] bg-[var(--surface-pill)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Update city image</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Upload a new hero image for this city page.
                      </p>
                    </div>
                    {cityImagePreviewSrc ? (
                      <span className="warning-badge rounded-full px-3 py-1 text-xs font-semibold">
                        Preview ready
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="button-secondary cursor-pointer rounded-full px-4 py-2 text-sm font-semibold">
                      Choose image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={(event) => void handleCityHeroImageChange(event)}
                        className="sr-only"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleSaveCityImage}
                      disabled={isPending || !cityImagePreviewSrc}
                      className="button-primary rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isPending ? 'Saving...' : 'Save image'}
                    </button>

                    {cityImagePreviewSrc ? (
                      <button
                        type="button"
                        onClick={() => setCityImagePreviewSrc(null)}
                        className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
                      >
                        Cancel preview
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Saved places</p>
              <h2 className="section-title mt-4 text-[2.6rem]">
                Stops to open inside {city.name}.
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-[var(--accent-strong)]">
                {city.placeCount} places configured for this city page
              </p>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isEditing) {
                      resetEditor(city);
                    }
                    setIsEditing((current) => !current);
                  }}
                  className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
                >
                  {isEditing ? 'Cancel edit' : 'Edit places'}
                </button>
              ) : null}
            </div>
          </div>

          {isAdmin && isEditing ? (
            <div className="glass-panel rounded-[30px] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold">Edit places for {city.name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Add new places or remove existing ones. Saving replaces the current list.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addPlace}
                  className="button-secondary rounded-full px-4 py-2 text-sm font-semibold"
                >
                  Add place
                </button>
              </div>

              {error ? (
                <div className="message-error mt-5 rounded-2xl px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4">
                {editablePlaces.map((place, index) => (
                  <div key={place.id} className="panel-tint rounded-[24px] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold">Place {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => removePlace(place.id)}
                        className="button-danger-soft rounded-full px-3 py-1.5 text-xs font-semibold"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium">Place name</span>
                        <input
                          type="text"
                          value={place.name}
                          onChange={(event) =>
                            updatePlace(place.id, { name: event.target.value })
                          }
                          className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                          placeholder="Place name"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium">Short summary</span>
                        <textarea
                          value={place.summary}
                          onChange={(event) =>
                            updatePlace(place.id, { summary: event.target.value })
                          }
                          className="field-control min-h-24 w-full rounded-2xl px-4 py-3 outline-none"
                          placeholder="Short summary for this place"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium">Place image</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={(event) => void handlePlaceImageChange(place.id, event)}
                          className="field-control w-full rounded-2xl px-4 py-3 text-sm"
                        />
                      </label>

                      {place.previewSrc ? (
                        <div className="contrast-panel rounded-[20px] p-3">
                          <div className="relative overflow-hidden rounded-[18px]">
                            <Image
                              src={place.previewSrc}
                              alt={place.name || `Place ${index + 1} preview`}
                              width={900}
                              height={700}
                              className="h-44 w-full object-cover"
                              unoptimized
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSavePlaces}
                  disabled={isPending}
                  className="button-primary rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPending ? 'Saving places...' : 'Save places'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetEditor(city);
                    setIsEditing(false);
                  }}
                  className="button-secondary rounded-full px-5 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {city.places.length > 0 ? (
              city.places.map((place) => (
                <article key={place.id} className="glass-panel overflow-hidden rounded-[30px]">
                  <div className="relative">
                    <Image
                      src={toImageSrc(place.imageBase64, place.imageMimeType)}
                      alt={place.name}
                      width={1200}
                      height={900}
                      className="h-64 w-full object-cover"
                      unoptimized
                    />
                    <div className="contrast-panel absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold shadow-none">
                      {city.name}
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="eyebrow">Place {place.displayOrder + 1}</p>
                    <h3 className="mt-3 text-2xl font-semibold">{place.name}</h3>
                    <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                      {place.summary ?? 'This place is part of the saved city route.'}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <div className="glass-panel rounded-[30px] p-6 text-[var(--muted)]">
                No places have been saved for this city yet.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Local guides</p>
              <h2 className="section-title mt-4 text-[2.6rem]">
                Guides available in {city.name}.
              </h2>
            </div>
          </div>

          {!isLoggedIn ? (
            <div className="glass-panel rounded-[30px] p-6">
              <p className="text-base font-semibold">Login to see city guides</p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Guide cards for {city.name} are shown only after login.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/login?next=${encodeURIComponent(`/cities/${city.slug}`)}`}
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
          ) : isGuidesLoading ? (
            <div className="glass-panel rounded-[30px] p-6 text-[var(--muted)]">
              Loading guides for {city.name}.
            </div>
          ) : guidesError ? (
            <div className="message-error rounded-2xl px-4 py-3 text-sm">
              {guidesError}
            </div>
          ) : cityGuides.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {cityGuides.map((guide) => (
                <article key={guide.id} className="glass-panel rounded-[28px] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="eyebrow">{guide.city}</p>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                        {guide.user.fullName}
                      </h3>
                    </div>
                    <span className="status-badge rounded-full px-3 py-1 text-xs font-semibold">
                      {guide.isAvailable ? 'Live now' : 'Busy'}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                    {guide.bio ?? 'Local guide profile ready for itinerary and booking workflows.'}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {guide.specialties.slice(0, 3).map((specialty) => (
                      <span
                        key={specialty}
                        className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center justify-between text-sm">
                    <span className="font-mono text-[var(--muted)]">
                      {guide.hourlyRate ? `From INR ${guide.hourlyRate}/hr` : 'Rate on request'}
                    </span>
                    <span className="font-semibold">
                      {guide.averageRating ? `${guide.averageRating} / 5` : 'Fresh profile'}
                    </span>
                  </div>

                  <div className="mt-6 border-t border-[var(--line)] pt-5">
                    {canRequestBookings ? (
                      guide.isAvailable ? (
                        <Link
                          href={`/guides/${guide.id}/book?city=${encodeURIComponent(city.slug)}`}
                          className="button-primary block w-full rounded-full px-5 py-3 text-center text-sm font-semibold"
                        >
                          Book guide
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="button-primary w-full rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Unavailable right now
                        </button>
                      )
                    ) : (
                      <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-pill)] px-4 py-3 text-sm text-[var(--muted)]">
                        Switch to a traveller account to request this guide.
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="glass-panel rounded-[30px] p-6 text-[var(--muted)]">
              No approved guides are live for this city yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
