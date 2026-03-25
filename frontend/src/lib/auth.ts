import type { AuthSession, UserRole } from '@/lib/api';

const AUTH_STORAGE_KEY = 'ghoomo.auth';

export function getPostLoginPath(role: UserRole) {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'GUIDE':
      return '/guides';
    case 'TOURIST':
    default:
      return '/guides';
  }
}

export function getStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function storeSession(session: AuthSession) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
