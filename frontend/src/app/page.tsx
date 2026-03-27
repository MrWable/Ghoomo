import Image from 'next/image';
import Link from 'next/link';
import { getCities } from '@/lib/api';
import { CityCoverageRail } from '@/components/city-coverage-rail';
import { HomeHeaderNav } from '@/components/home-header-nav';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const cities = await getCities();
  const cityCoverage = cities;
  const totalPlaces = cityCoverage.reduce(
    (count, city) => count + city.placeCount,
    0,
  );

  const startingRate = cityCoverage.reduce<number | null>((current, city) => {
    if (!city.startingRate) {
      return current;
    }

    if (!current || city.startingRate < current) {
      return city.startingRate;
    }

    return current;
  }, null);

  return (
    <main className="pb-20 pt-6">
      <div className="page-shell space-y-8">
        <header className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-[32px] px-5 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-black uppercase text-[var(--on-accent)]">
              G
            </span>
            <span className="font-mono text-sm uppercase tracking-[0.2em]">Ghoomo</span>
          </Link>

          <HomeHeaderNav />
        </header>

        {cityCoverage.length > 0 ? (
          <CityCoverageRail cities={cityCoverage} />
        ) : (
          <section className="py-2">
            <div className="glass-panel rounded-[28px] p-6 text-[var(--muted)]">
              No live cities have been added yet. Use the admin dashboard to create city
              cards with images.
            </div>
          </section>
        )}

        <section className="hero-shell relative overflow-hidden rounded-[44px] px-6 py-8 md:px-10 md:py-12">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="eyebrow">Cities live on Ghoomo right now</p>
              <h1 className="hero-wordmark mt-5">GHOOMO</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                Explore the live cities, see the saved places inside each one, and create an
                account before you start booking with local guides. Guide cards are private to
                the guide and the admin dashboard.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {cityCoverage.slice(0, 5).map((city) => (
                  <span
                    key={city.id}
                    className="tag-soft rounded-full px-4 py-2 text-sm font-medium"
                  >
                    {city.name}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="button-primary rounded-full px-5 py-3 text-sm font-semibold"
                >
                  Register as user
                </Link>
                <Link
                  href="/guides/register"
                  className="button-secondary rounded-full px-5 py-3 text-sm font-semibold"
                >
                  Become a guide
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                <div className="glass-panel rounded-[24px] p-4">
                  <p className="text-sm text-[var(--muted)]">Live cities</p>
                  <p className="mt-2 text-3xl font-semibold">{cityCoverage.length}</p>
                </div>
                <div className="glass-panel rounded-[24px] p-4">
                  <p className="text-sm text-[var(--muted)]">Saved places</p>
                  <p className="mt-2 text-3xl font-semibold">{totalPlaces}</p>
                </div>
                <div className="glass-panel rounded-[24px] p-4">
                  <p className="text-sm text-[var(--muted)]">Starting rate</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {startingRate ? `INR ${startingRate}` : "TBD"}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              {/* <div className="floating-panel panel-tint-strong mb-3 rounded-[24px] px-4 py-3 shadow-xl backdrop-blur md:absolute md:-left-3 md:top-6 md:z-10 md:mb-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                  Platform status
                </p>
                <p className="mt-2 text-sm font-medium">
                  {health ? `${health.status} / db ${health.database}` : "Backend unavailable"}
                </p>
              </div> */}

              <div className="glass-panel overflow-hidden rounded-[36px] p-4 md:p-5">
                <Image
                  src="/ghoomo-hero-scene.svg"
                  alt="Illustrated Ghoomo travel collage"
                  width={1200}
                  height={900}
                  className="h-full w-full rounded-[28px] object-cover"
                  priority
                />
              </div>

              <div className="floating-panel contrast-panel mt-3 rounded-[24px] px-4 py-3 shadow-xl md:absolute md:bottom-4 md:right-4 md:mt-0">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--contrast-muted)]">
                  Currently live
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {cityCoverage.map((city) => city.name).slice(0, 3).join(" • ") || "Launching soon"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "City-first discovery",
              copy: "The home screen now reflects the cities activated by admin instead of placeholder geography.",
            },
            {
              title: "Role-based access",
              copy: "Normal users land on the home page, guides see only their own card, and the full guide table stays inside admin.",
            },
            {
              title: "Admin-managed",
              copy: "Cities, summaries, places, and guide approvals are controlled from the admin dashboard and rendered directly from database data.",
            },
          ].map((item) => (
            <article key={item.title} className="glass-panel rounded-[28px] p-6">
              <p className="eyebrow">{item.title}</p>
              <p className="mt-4 text-base leading-7 text-[var(--muted)]">{item.copy}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
