'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AuthSession } from '@/lib/api';
import { clearSession, getPostLoginPath, getStoredSession } from '@/lib/auth';

function getRoleLabel(session: AuthSession) {
  switch (session.user.role) {
    case 'ADMIN':
      return 'Admin dashboard';
    case 'GUIDE':
      return 'My guide card';
    case 'USER':
    case 'TOURIST':
    default:
      return null;
  }
}

function getDisplayRole(role: AuthSession['user']['role']) {
  switch (role) {
    case 'TOURIST':
      return 'USER';
    default:
      return role;
  }
}

export function HomeHeaderNav() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    function syncSession() {
      setSession(getStoredSession());
    }

    syncSession();
    window.addEventListener('storage', syncSession);

    return () => {
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  function handleLogout() {
    clearSession();
    setSession(null);
    router.replace('/');
    router.refresh();
  }

  return (
    <nav className="flex flex-wrap items-center justify-end gap-4 text-sm text-[var(--muted)]">
      {session ? (
        <>
          <span className="tag-soft rounded-full px-3 py-1 text-xs font-semibold">
            {getDisplayRole(session.user.role)}
          </span>
          {getRoleLabel(session) ? (
            <Link href={getPostLoginPath(session.user.role)}>
              {getRoleLabel(session)}
            </Link>
          ) : null}
          <button type="button" onClick={handleLogout} className="font-semibold">
            Logout
          </button>
        </>
      ) : (
        <>
          <Link href="/register">Register</Link>
          <Link href="/login">Login</Link>
        </>
      )}
    </nav>
  );
}
