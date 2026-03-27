'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { getCities, registerGuide } from '@/lib/api';

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
  aadhaarNumber: string;
  panNumber: string;
  aadhaarImageDataUrl: string;
  aadhaarImageName: string;
  panImageDataUrl: string;
  panImageName: string;
  passportPhotoDataUrl: string;
  passportPhotoName: string;
};

type UploadField = 'aadhaarImage' | 'panImage' | 'passportPhoto';

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
  aadhaarNumber: '',
  panNumber: '',
  aadhaarImageDataUrl: '',
  aadhaarImageName: '',
  panImageDataUrl: '',
  panImageName: '',
  passportPhotoDataUrl: '',
  passportPhotoName: '',
};

function toList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

function parseUpload(label: string, dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(',');

  if (separatorIndex === -1) {
    throw new Error(`${label} is required.`);
  }

  const header = dataUrl.slice(0, separatorIndex);
  const imageBase64 = dataUrl.slice(separatorIndex + 1);
  const mimeMatch = header.match(/^data:(.+);base64$/);

  if (!mimeMatch || !imageBase64) {
    throw new Error(`${label} is invalid.`);
  }

  return {
    imageBase64,
    imageMimeType: mimeMatch[1],
  };
}

function ImagePreviewCard({
  title,
  caption,
  dataUrl,
}: {
  title: string;
  caption: string;
  dataUrl: string;
}) {
  return (
    <div className="contrast-panel rounded-[24px] p-4">
      <p className="text-sm font-semibold text-[var(--contrast-foreground)]">{title}</p>
      <div className="relative mt-4 overflow-hidden rounded-[20px]">
        <Image
          src={dataUrl}
          alt={title}
          width={900}
          height={700}
          className="h-48 w-full object-cover"
          unoptimized
        />
      </div>
      <p className="mt-3 text-sm text-[var(--contrast-muted)]">{caption}</p>
    </div>
  );
}

export function GuideRegistrationForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCities() {
      const cities = await getCities();

      if (!isMounted) {
        return;
      }

      setAvailableCities(cities.map((city) => city.name));
    }

    void loadCities();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleImageChange(
    field: UploadField,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    const fieldMap = {
      aadhaarImage: {
        dataUrlKey: 'aadhaarImageDataUrl',
        nameKey: 'aadhaarImageName',
        label: 'Aadhaar card image',
      },
      panImage: {
        dataUrlKey: 'panImageDataUrl',
        nameKey: 'panImageName',
        label: 'PAN card image',
      },
      passportPhoto: {
        dataUrlKey: 'passportPhotoDataUrl',
        nameKey: 'passportPhotoName',
        label: 'Passport photo',
      },
    } as const;
    const config = fieldMap[field];

    if (!file) {
      setForm((current) => ({
        ...current,
        [config.dataUrlKey]: '',
        [config.nameKey]: '',
      }));
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError(`Upload a valid ${config.label.toLowerCase()}.`);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError(`${config.label} must be under 2 MB.`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);

      setForm((current) => ({
        ...current,
        [config.dataUrlKey]: dataUrl,
        [config.nameKey]: file.name,
      }));
      setError(null);
    } catch (imageError) {
      setError(
        imageError instanceof Error
          ? imageError.message
          : `Unable to read ${config.label.toLowerCase()}.`,
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    setError(null);
    setIsSubmitting(true);

    try {
      const aadhaarImage = form.aadhaarImageDataUrl
        ? parseUpload('Aadhaar card image', form.aadhaarImageDataUrl)
        : null;
      const panImage = form.panImageDataUrl
        ? parseUpload('PAN card image', form.panImageDataUrl)
        : null;
      const passportPhoto = form.passportPhotoDataUrl
        ? parseUpload('Passport photo', form.passportPhotoDataUrl)
        : null;

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
        aadhaarNumber: form.aadhaarNumber.trim() || undefined,
        panNumber: form.panNumber.trim() || undefined,
        aadhaarImageBase64: aadhaarImage?.imageBase64,
        aadhaarImageMimeType: aadhaarImage?.imageMimeType,
        panImageBase64: panImage?.imageBase64,
        panImageMimeType: panImage?.imageMimeType,
        passportPhotoBase64: passportPhoto?.imageBase64,
        passportPhotoMimeType: passportPhoto?.imageMimeType,
      });

      setIsSuccess(true);
      setForm(initialState);
      formElement.reset();
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
          Submit your guide profile and identity documents here. New guide accounts are
          created immediately but stay in the admin review queue until approved, so they
          will not appear publicly right away.
        </p>

        {isSuccess ? (
          <div className="message-success mt-8 rounded-[24px] p-5">
            <p className="text-base font-semibold">Registration submitted.</p>
            <p className="mt-2 text-sm leading-6">
              Your guide profile is now pending admin approval. Once approved, your city
              and profile will appear in the public guide directory and homepage coverage
              section.
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
                className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">City</span>
              <input
                type="text"
                value={form.city}
                onChange={(event) => updateField('city', event.target.value)}
                list="active-cities"
                className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                placeholder={availableCities[0] ?? 'Pune'}
                required
              />
              <datalist id="active-cities">
                {availableCities.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                className="field-control w-full rounded-2xl px-4 py-3 outline-none"
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
                className="field-control w-full rounded-2xl px-4 py-3 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Hourly rate (INR)</span>
              <input
                type="number"
                min="0"
                value={form.hourlyRate}
                onChange={(event) => updateField('hourlyRate', event.target.value)}
                className="field-control w-full rounded-2xl px-4 py-3 outline-none"
              />
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Aadhaar card number</span>
              <input
                type="text"
                value={form.aadhaarNumber}
                onChange={(event) => updateField('aadhaarNumber', event.target.value)}
                className="field-control w-full rounded-2xl px-4 py-3 outline-none"
                placeholder="1234 5678 9012 (optional)"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">PAN card number</span>
              <input
                type="text"
                value={form.panNumber}
                onChange={(event) => updateField('panNumber', event.target.value.toUpperCase())}
                className="field-control w-full rounded-2xl px-4 py-3 outline-none uppercase"
                placeholder="ABCDE1234F (optional)"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Bio</span>
            <textarea
              value={form.bio}
              onChange={(event) => updateField('bio', event.target.value)}
              className="field-control min-h-28 w-full rounded-2xl px-4 py-3 outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Languages</span>
            <input
              type="text"
              value={form.languages}
              onChange={(event) => updateField('languages', event.target.value)}
              className="field-control w-full rounded-2xl px-4 py-3 outline-none"
              placeholder="English, Hindi, Marathi"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">Specialties</span>
            <input
              type="text"
              value={form.specialties}
              onChange={(event) => updateField('specialties', event.target.value)}
              className="field-control w-full rounded-2xl px-4 py-3 outline-none"
              placeholder="Temple tours, Food walks"
            />
          </label>

          <div className="space-y-4 rounded-[28px] border border-[var(--line)] p-5">
            <div>
              <p className="text-sm font-semibold">Verification documents</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Upload Aadhaar, PAN, or passport-size photo if available. These are optional,
                and image uploads are limited to 2 MB each.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Aadhaar card image</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void handleImageChange('aadhaarImage', event)}
                  className="field-control w-full rounded-2xl px-4 py-3 text-sm"
                />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {form.aadhaarImageName || 'Optional: PNG, JPG, or WEBP'}
                </p>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">PAN card image</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void handleImageChange('panImage', event)}
                  className="field-control w-full rounded-2xl px-4 py-3 text-sm"
                />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {form.panImageName || 'Optional: PNG, JPG, or WEBP'}
                </p>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">Passport-size photo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void handleImageChange('passportPhoto', event)}
                  className="field-control w-full rounded-2xl px-4 py-3 text-sm"
                />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {form.passportPhotoName || 'Optional: PNG, JPG, or WEBP'}
                </p>
              </label>
            </div>

            {form.aadhaarImageDataUrl ||
            form.panImageDataUrl ||
            form.passportPhotoDataUrl ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {form.aadhaarImageDataUrl ? (
                  <ImagePreviewCard
                    title="Aadhaar card preview"
                    caption={form.aadhaarImageName || 'Selected Aadhaar image'}
                    dataUrl={form.aadhaarImageDataUrl}
                  />
                ) : null}
                {form.panImageDataUrl ? (
                  <ImagePreviewCard
                    title="PAN card preview"
                    caption={form.panImageName || 'Selected PAN image'}
                    dataUrl={form.panImageDataUrl}
                  />
                ) : null}
                {form.passportPhotoDataUrl ? (
                  <ImagePreviewCard
                    title="Passport photo preview"
                    caption={form.passportPhotoName || 'Selected passport photo'}
                    dataUrl={form.passportPhotoDataUrl}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="message-error rounded-2xl px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="button-primary w-fit rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
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
            'Admin reviews your city, languages, specialties, Aadhaar, PAN, and passport photo.',
            'After approval, you can open your own guide card after login.',
            'Cities shown on the homepage are managed by admin, so try to use an active city name.',
          ].map((step) => (
            <div key={step} className="panel-tint rounded-[24px] p-5">
              <p className="text-sm leading-7 text-[var(--muted)]">{step}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-[var(--accent-strong)]">
          <Link href="/">Home</Link>
          <Link href="/register">Register user</Link>
          <Link href="/login">Login</Link>
        </div>
      </aside>
    </div>
  );
}
