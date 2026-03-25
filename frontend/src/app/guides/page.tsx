import Link from "next/link";
import { getGuides } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function GuidesPage() {
  const guides = await getGuides();

  return (
    <main className="pb-16 pt-8">
      <div className="page-shell">
        <header className="glass-panel flex items-center justify-between rounded-full px-5 py-3">
          <Link href="/" className="font-mono text-sm uppercase tracking-[0.2em]">
            Ghoomo
          </Link>
          <div className="flex items-center gap-5 text-sm text-[var(--muted)]">
            <Link href="/guides/register">Become a guide</Link>
            <Link href="/login">Login</Link>
            <Link href="/admin">Admin</Link>
            <Link href="/">Back to home</Link>
          </div>
        </header>

        <section className="py-10">
          <p className="eyebrow">Guide directory</p>
          <h1 className="section-title mt-4">Starter guide listing</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            This page consumes the public backend endpoint and renders verified guides from the
            PostgreSQL seed data.
          </p>
          <div className="mt-6">
            <Link
              href="/guides/register"
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Register as guide
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {guides.length > 0 ? (
            guides.map((guide) => (
              <article key={guide.id} className="glass-panel rounded-[28px] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-[var(--muted)]">{guide.city}</p>
                    <h2 className="mt-1 text-2xl font-semibold">{guide.user.fullName}</h2>
                  </div>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
                    {guide.isAvailable ? "Available" : "Busy"}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                  {guide.bio ?? "Profile is ready for custom itinerary details."}
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
                <div className="mt-5 flex flex-wrap gap-2">
                  {guide.specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium"
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
                    {guide.averageRating ? `${guide.averageRating} / 5` : "No reviews yet"}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="glass-panel rounded-[28px] p-6 text-[var(--muted)]">
              No guides yet. Run the backend with the seeded PostgreSQL database first.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
