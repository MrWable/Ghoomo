import Link from "next/link";
import { getGuides, getHealthStatus, type Guide } from "@/lib/api";

export const dynamic = "force-dynamic";

function GuideCard({ guide }: { guide: Guide }) {
  return (
    <article className="glass-panel rounded-[28px] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--muted)]">{guide.city}</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">
            {guide.user.fullName}
          </h3>
        </div>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
          {guide.isAvailable ? "Available" : "Busy"}
        </span>
      </div>
      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
        {guide.bio ?? "Local guide profile ready for itinerary and booking workflows."}
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
          {guide.hourlyRate ? `INR ${guide.hourlyRate}/hr` : "Rate on request"}
        </span>
        <span className="font-medium">
          {guide.averageRating ? `${guide.averageRating} / 5` : "New profile"}
        </span>
      </div>
    </article>
  );
}

export default async function Home() {
  const [health, guides] = await Promise.all([getHealthStatus(), getGuides()]);
  const featuredGuides = guides.slice(0, 2);
  const cityCoverage = Array.from(
    guides.reduce((cities, guide) => {
      const existing = cities.get(guide.city) ?? {
        city: guide.city,
        guideCount: 0,
        startingRate: guide.hourlyRate,
      };

      existing.guideCount += 1;

      if (
        guide.hourlyRate &&
        (!existing.startingRate || guide.hourlyRate < existing.startingRate)
      ) {
        existing.startingRate = guide.hourlyRate;
      }

      cities.set(guide.city, existing);
      return cities;
    }, new Map<string, { city: string; guideCount: number; startingRate: number | null }>()),
  ).map(([, value]) => value);

  return (
    <main className="pb-16 pt-8">
      <div className="page-shell">
        <header className="glass-panel flex items-center justify-between rounded-full px-5 py-3">
          <Link href="/" className="font-mono text-sm uppercase tracking-[0.2em]">
            Ghoomo
          </Link>
          <nav className="flex items-center gap-5 text-sm text-[var(--muted)]">
            <Link href="/guides">Guides</Link>
            <Link href="/guides/register">Become a guide</Link>
            <Link href="/login">Login</Link>
            <Link href="/admin">Admin</Link>
            <a href="http://localhost:4000/api/v1/health" target="_blank" rel="noreferrer">
              API
            </a>
          </nav>
        </header>

        <section className="grid gap-6 py-10 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="glass-panel rounded-[36px] p-8 md:p-12">
            <p className="eyebrow">On-demand local guide platform</p>
            <h1 className="section-title mt-5 max-w-3xl">
              Start the Ghoomo MVP with separate frontend, backend, and database layers.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              This first milestone trims the report down to the core product: guide
              discovery, account roles, bookings, and a clean PostgreSQL-backed foundation
              for future features like payments, itinerary approval, and admin workflows.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/guides"
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              >
                Explore starter guides
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold"
              >
                Login as admin
              </Link>
              <Link
                href="/guides/register"
                className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold"
              >
                Register as guide
              </Link>
              <a
                href="http://localhost:4000/api/v1/health"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold"
              >
                Check API health
              </a>
            </div>
          </div>

          <aside className="glass-panel rounded-[36px] p-8">
            <p className="eyebrow">System snapshot</p>
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-sm text-[var(--muted)]">Frontend</p>
                <p className="mt-1 text-xl font-semibold">Next.js + TypeScript</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Backend</p>
                <p className="mt-1 text-xl font-semibold">NestJS + Fastify</p>
              </div>
              <div>
                <p className="text-sm text-[var(--muted)]">Database</p>
                <p className="mt-1 text-xl font-semibold">PostgreSQL + Prisma</p>
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-white/60 p-4">
                <p className="text-sm text-[var(--muted)]">Backend status</p>
                <p className="mt-2 text-lg font-semibold">
                  {health ? `${health.status} / db ${health.database}` : "Backend not reachable yet"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {health?.timestamp ?? "Start the API and database to populate live status."}
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Tourist flow",
              copy: "Browse verified guides, compare rates, and place bookings with a simple API contract.",
            },
            {
              title: "Guide flow",
              copy: "Register, manage availability, and accept or reject booking requests from one backend.",
            },
            {
              title: "Admin-ready base",
              copy: "Role structure and schema are in place so verification and moderation can be added cleanly.",
            },
          ].map((item) => (
            <article key={item.title} className="glass-panel rounded-[28px] p-6">
              <p className="eyebrow">{item.title}</p>
              <p className="mt-4 text-base leading-7 text-[var(--muted)]">{item.copy}</p>
            </article>
          ))}
        </section>

        <section className="py-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Current city coverage</p>
              <h2 className="section-title mt-4 text-[2.3rem]">
                Cities where verified guides are live right now.
              </h2>
            </div>
            <p className="text-sm font-semibold text-[var(--accent-strong)]">
              {cityCoverage.length} active cities
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cityCoverage.length > 0 ? (
              cityCoverage.map((city) => (
                <article key={city.city} className="glass-panel rounded-[28px] p-6">
                  <p className="eyebrow">Live city</p>
                  <h3 className="mt-4 text-2xl font-semibold">{city.city}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {city.guideCount} verified {city.guideCount === 1 ? "guide" : "guides"} currently available for public discovery.
                  </p>
                  <p className="mt-5 text-sm font-medium text-[var(--accent-strong)]">
                    {city.startingRate ? `From INR ${city.startingRate}/hr` : "Rate on request"}
                  </p>
                </article>
              ))
            ) : (
              <div className="glass-panel rounded-[28px] p-6 text-[var(--muted)]">
                No approved guide cities yet. Approve a guide from the admin dashboard to make a city live.
              </div>
            )}
          </div>
        </section>

        <section className="py-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Seeded guide previews</p>
              <h2 className="section-title mt-4 text-[2.3rem]">Use real sample data from day one.</h2>
            </div>
            <Link href="/guides" className="text-sm font-semibold text-[var(--accent-strong)]">
              View all guides
            </Link>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {featuredGuides.length > 0 ? (
              featuredGuides.map((guide) => <GuideCard key={guide.id} guide={guide} />)
            ) : (
              <div className="glass-panel rounded-[28px] p-6 text-[var(--muted)]">
                Run the database migration and seed to see guide cards here.
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-[36px] p-8 md:p-10">
          <p className="eyebrow">Deferred for later phases</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {["Payment gateway", "Real-time tracking", "Admin dashboard"].map((item) => (
              <div key={item} className="rounded-[24px] border border-[var(--line)] bg-white/60 p-5">
                <h3 className="text-lg font-semibold">{item}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Kept out of the first milestone so the team can stabilize auth, guides,
                  bookings, and schema first.
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
