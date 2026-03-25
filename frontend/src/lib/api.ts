const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export type UserRole = 'TOURIST' | 'GUIDE' | 'ADMIN';
export type GuideVerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type Guide = {
  id: string;
  city: string;
  languages: string[];
  specialties: string[];
  bio: string | null;
  hourlyRate: number | null;
  verificationStatus: GuideVerificationStatus;
  isVerified: boolean;
  isAvailable: boolean;
  createdAt?: string;
  averageRating: number | null;
  reviewCount: number;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type HealthStatus = {
  service: string;
  status: string;
  database: string;
  timestamp: string;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  guideProfileId: string | null;
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

export type GuideRegistrationInput = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  city: string;
  bio?: string;
  hourlyRate?: number;
  languages: string[];
  specialties: string[];
};

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getHealthStatus() {
  return readJson<HealthStatus>('/health');
}

export async function getGuides(city?: string) {
  const search = city ? `?city=${encodeURIComponent(city)}` : '';
  const response = await readJson<{ items: Guide[] }>(`/guides${search}`);
  return response?.items ?? [];
}

function readErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload
  ) {
    const message = (payload as { message: string | string[] }).message;
    return Array.isArray(message) ? message.join(', ') : message;
  }

  return 'Request failed.';
}

export async function login(credentials: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  const payload = (await response.json()) as AuthSession | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload as AuthSession;
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as AuthUser | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload as AuthUser;
}

export async function registerGuide(
  input: GuideRegistrationInput,
): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      role: 'GUIDE',
    }),
  });

  const payload = (await response.json()) as AuthSession | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload as AuthSession;
}

export async function getGuidesForAdmin(
  token: string,
  status: GuideVerificationStatus = 'PENDING',
) {
  const response = await fetch(
    `${API_BASE_URL}/guides/admin/review?status=${status}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    },
  );

  const payload = (await response.json()) as
    | { items: Guide[] }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { items: Guide[] }).items;
}

export async function updateGuideVerification(
  token: string,
  guideId: string,
  status: Extract<GuideVerificationStatus, 'APPROVED' | 'REJECTED'>,
) {
  const response = await fetch(`${API_BASE_URL}/guides/${guideId}/verification`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  const payload = (await response.json()) as
    | { item: Guide }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: Guide }).item;
}
