'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import type { City } from '@/lib/api';

const CITY_ARTWORK = [
  '/city-card-ridge.svg',
  '/city-card-river.svg',
  '/city-card-bazaar.svg',
  '/city-card-fort.svg',
];

function CityCard({
  city,
  index,
}: {
  city: City;
  index: number;
}) {
  const hasImage = Boolean(city.imageBase64);
  const imageSrc = hasImage
    ? `data:${city.imageMimeType};base64,${city.imageBase64}`
    : CITY_ARTWORK[index % CITY_ARTWORK.length];
  const guideLabel =
    city.guideCount > 0
      ? `${city.guideCount} ${city.guideCount === 1 ? 'guide' : 'guides'}`
      : 'New city';

  return (
    <Link
      href={`/cities/${city.slug}`}
      className="group block min-w-[320px] max-w-[340px] flex-1 snap-start"
    >
      <article className="city-card h-full rounded-[32px] border border-[var(--city-card-meta-border)] p-4 text-[var(--contrast-foreground)] sm:p-5">
        <div className="relative overflow-hidden rounded-[24px]">
          <Image
            src={imageSrc}
            alt={`${city.name} city artwork`}
            width={900}
            height={700}
            className="h-44 w-full object-cover object-center"
            unoptimized={hasImage}
          />
          <div className="city-card__overlay absolute inset-0" />
          <div className="city-card__chip absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold shadow-lg backdrop-blur">
            {guideLabel}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="city-card__panel rounded-[18px] p-3 shadow-lg backdrop-blur-sm">
              <p className="city-card__panel-label text-[11px] font-semibold uppercase tracking-[0.2em]">
                Ghoomo City
              </p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-2xl font-semibold tracking-tight text-[var(--contrast-foreground)]">
                    {city.name}
                  </h3>
                  <p className="city-card__panel-copy mt-1 line-clamp-1 text-sm">
                    {city.summary ??
                      `${city.guideCount} verified ${city.guideCount === 1 ? 'guide' : 'guides'} available right now.`}
                  </p>
                </div>
                <span className="city-card__state rounded-full px-3 py-1 text-xs font-semibold">
                  {city.isActive ? 'Live' : 'Saved'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="city-card__body px-1 pb-1 pt-5">
          <p className="city-card__eyebrow eyebrow">City coverage</p>
          <div className="city-card__meta mt-4 rounded-[18px] px-4 py-3">
            <p className="city-card__meta-label text-[11px] font-semibold uppercase tracking-[0.18em]">
              Why this city
            </p>
            <p className="city-card__meta-copy mt-2 text-sm leading-6">
              {city.summary ??
                `${city.guideCount} verified ${city.guideCount === 1 ? 'guide' : 'guides'} currently available through Ghoomo.`}
            </p>
          </div>
          <div className="city-card__footer mt-4 flex items-center justify-between text-sm font-medium">
            <span>{city.startingRate ? `From INR ${city.startingRate}/hr` : 'Rate on request'}</span>
            <span className="city-card__link rounded-full px-3 py-1">
              {city.placeCount} {city.placeCount === 1 ? 'place' : 'places'}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function CityCoverageRail({ cities }: { cities: City[] }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredCities = normalizedQuery
    ? cities.filter((city) => {
        return city.name.toLowerCase().includes(normalizedQuery);
      })
    : cities;

  return (
    <section className="space-y-6 py-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Live city coverage</p>
          <h2 className="section-title mt-4 text-[2.6rem]">
            Where Ghoomo is present right now.
          </h2>
        </div>
        <p className="text-sm font-semibold text-[var(--accent-strong)]">
          {cities.length} active cities configured for the public homepage
        </p>
      </div>

      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-[28px] px-5 py-4 lg:flex-nowrap">
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-semibold">Search a city</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Find one live city fast, otherwise we show a launching-soon state.
          </p>
        </div>
        <label className="block w-full lg:w-[30rem] xl:w-[36rem]">
          <span className="sr-only">Search city</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field-control w-full rounded-2xl px-4 py-3 outline-none"
            placeholder="Search Pune, Nashik, Kolhapur..."
          />
        </label>
      </div>

      {filteredCities.length > 0 ? (
        <div className="horizontal-scroll-strip flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {filteredCities.map((city, index) => (
            <CityCard key={city.id} city={city} index={index} />
          ))}
        </div>
      ) : (
        <div className="contrast-panel rounded-[30px] p-6">
          <p className="eyebrow !text-[var(--contrast-muted)]">Launching soon</p>
          <h3 className="mt-3 text-2xl font-semibold">
            {query.trim() ? `${query.trim()} is not live yet.` : 'No city found yet.'}
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--contrast-muted)]">
            We could not find a live city for this search right now. Try another city name
            or check back after the admin team publishes it.
          </p>
        </div>
      )}
    </section>
  );
}
