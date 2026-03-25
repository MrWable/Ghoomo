'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  getCurrentUser,
  getGuides,
  getGuidesForAdmin,
  getHealthStatus,
  updateGuideVerification,
  type AuthUser,
  type Guide,
  type HealthStatus,
} from '@/lib/api';
import { clearSession, getStoredSession } from '@/lib/auth';

type DashboardState = {
  user: AuthUser | null;
  health: HealthStatus | null;
  pendingGuides: Guide[];
  liveGuides: Guide[];
  isLoading: boolean;
  actionGuideId: string | null;
  error: string | null;
};

export function AdminDashboard() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({
    user: null,
    health: null,
    pendingGuides: [],
    liveGuides: [],
    isLoading: true,
    actionGuideId: null,
    error: null,
  });

  async function loadDashboard(token: string) {
    const [user, health, pendingGuides, liveGuides] = await Promise.all([
      getCurrentUser(token),
      getHealthStatus(),
      getGuidesForAdmin(token, 'PENDING'),
      getGuides(),
    ]);

    return {
      user,
      health,
      pendingGuides,
      liveGuides,
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
      const [pendingGuides, liveGuides] = await Promise.all([
        getGuidesForAdmin(session.accessToken, 'PENDING'),
        getGuides(),
      ]);

      setState((current) => ({
        ...current,
        pendingGuides,
        liveGuides,
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

  const liveCities = Array.from(new Set(state.liveGuides.map((guide) => guide.city))).length;

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[36px] p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Admin dashboard</p>
            <h1 className="section-title mt-4 text-[2.5rem]">
              Welcome, {state.user?.fullName}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Review pending guide profiles here. Approval makes a guide public and includes
              their city in the homepage coverage section.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold"
          >
            Logout
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="glass-panel rounded-[28px] p-6">
          <p className="text-sm text-[var(--muted)]">Role</p>
          <p className="mt-2 text-2xl font-semibold">{state.user?.role}</p>
        </article>
        <article className="glass-panel rounded-[28px] p-6">
          <p className="text-sm text-[var(--muted)]">Pending guides</p>
          <p className="mt-2 text-2xl font-semibold">{state.pendingGuides.length}</p>
        </article>
        <article className="glass-panel rounded-[28px] p-6">
          <p className="text-sm text-[var(--muted)]">Live guides</p>
          <p className="mt-2 text-2xl font-semibold">{state.liveGuides.length}</p>
        </article>
        <article className="glass-panel rounded-[28px] p-6">
          <p className="text-sm text-[var(--muted)]">Live cities</p>
          <p className="mt-2 text-2xl font-semibold">{liveCities}</p>
        </article>
      </section>

      <section className="glass-panel rounded-[36px] p-8 md:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Guide verification queue</p>
            <h2 className="section-title mt-4 text-[2.2rem]">Pending guide approvals</h2>
          </div>
          <div className="rounded-[24px] border border-[var(--line)] bg-white/60 px-4 py-3 text-sm">
            API: {state.health ? `${state.health.status} / db ${state.health.database}` : 'Unavailable'}
          </div>
        </div>

        {state.error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {state.pendingGuides.length > 0 ? (
            state.pendingGuides.map((guide) => {
              const isBusy = state.actionGuideId === guide.id;

              return (
                <article key={guide.id} className="rounded-[28px] border border-[var(--line)] bg-white/60 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-[var(--muted)]">{guide.city}</p>
                      <h3 className="mt-1 text-2xl font-semibold">{guide.user.fullName}</h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">{guide.user.email}</p>
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      {guide.verificationStatus}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
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
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="text-sm text-[var(--muted)]">
                      <p>{guide.hourlyRate ? `INR ${guide.hourlyRate}/hr` : 'Rate not provided'}</p>
                      <p>{guide.createdAt ? `Submitted ${new Date(guide.createdAt).toLocaleDateString()}` : ''}</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleVerification(guide.id, 'APPROVED')}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isBusy ? 'Updating...' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleVerification(guide.id, 'REJECTED')}
                        className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isBusy ? 'Updating...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[28px] border border-[var(--line)] bg-white/60 p-6 text-[var(--muted)]">
              No pending guides right now.
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold text-[var(--accent-strong)]">
          <Link href="/">Home</Link>
          <Link href="/guides">Public guides</Link>
          <Link href="/guides/register">Guide registration</Link>
          <a href="http://localhost:4000/api/v1/health" target="_blank" rel="noreferrer">
            API health
          </a>
        </div>
      </section>
    </div>
  );
}
