const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export type UserRole = "TOURIST" | "USER" | "GUIDE" | "ADMIN";
export type GuideVerificationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NO_SHOW";
export type PaymentStatus =
  | "PENDING"
  | "ORDER_CREATED"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

export type GuideAvailabilityBlock = {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  acceptingBookings: boolean;
  createdAt?: string;
  profileImageBase64?: string | null;
  profileImageMimeType?: string | null;
  averageRating: number | null;
  reviewCount: number;
  availabilityBlocks?: GuideAvailabilityBlock[];
  user: {
    id: string;
    fullName: string;
    email: string;
    role?: UserRole;
  };
};

export type GuideKyc = {
  aadhaarNumber: string | null;
  panNumber: string | null;
  aadhaarImageBase64: string | null;
  aadhaarImageMimeType: string | null;
  panImageBase64: string | null;
  panImageMimeType: string | null;
  passportPhotoBase64: string | null;
  passportPhotoMimeType: string | null;
};

export type ReviewGuide = Guide & {
  kyc?: GuideKyc | null;
};

export type AdminUserRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
  guideProfile: {
    id: string;
    city: string;
    languages: string[];
    specialties: string[];
    bio: string | null;
    hourlyRate: number | null;
    verificationStatus: GuideVerificationStatus;
    isVerified: boolean;
    isAvailable: boolean;
    acceptingBookings: boolean;
    createdAt?: string;
    averageRating: number | null;
    reviewCount: number;
    kyc?: GuideKyc | null;
  } | null;
};

export type CityPlace = {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  imageBase64: string;
  imageMimeType: string;
  displayOrder: number;
};

export type City = {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  imageBase64: string;
  imageMimeType: string;
  isActive: boolean;
  createdAt?: string;
  guideCount: number;
  startingRate: number | null;
  placeCount: number;
};

export type CityDetail = City & {
  places: CityPlace[];
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

export type BookingReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Booking = {
  id: string;
  status: BookingStatus;
  message: string | null;
  totalAmount: number | null;
  paymentStatus: PaymentStatus;
  paymentGateway: string | null;
  paymentOrderId: string | null;
  paymentId: string | null;
  paymentCurrency: string | null;
  paymentAmount: number | null;
  paymentPaidAt: string | null;
  travelDate: string;
  startAt: string;
  endAt: string;
  timezone: string | null;
  guestCount: number;
  meetingPoint: string | null;
  cancellationReason: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  tourist: {
    id: string;
    fullName: string;
    email: string;
  };
  guide: {
    guideProfileId: string;
    userId: string;
    city: string;
    hourlyRate: number | null;
    acceptingBookings: boolean;
    fullName: string;
    email: string;
  };
  review: BookingReview | null;
};

export type GuideAvailabilityCheck = {
  guideProfileId: string;
  startAt: string;
  endAt: string;
  isAvailable: boolean;
  reason: string | null;
};

export type UserRegistrationInput = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
};

export type UpdateMyGuideInput = {
  city: string;
  languages: string[];
  specialties: string[];
  bio?: string | null;
  hourlyRate?: number | null;
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
  aadhaarNumber?: string;
  panNumber?: string;
  aadhaarImageBase64?: string;
  aadhaarImageMimeType?: string;
  panImageBase64?: string;
  panImageMimeType?: string;
  passportPhotoBase64?: string;
  passportPhotoMimeType?: string;
};

export type CreateCityInput = {
  name: string;
  summary?: string;
  imageBase64: string;
  imageMimeType: string;
  isActive?: boolean;
  places?: Array<{
    name: string;
    summary?: string;
    imageBase64: string;
    imageMimeType: string;
    displayOrder?: number;
  }>;
};

export type CreateBookingInput = {
  guideProfileId: string;
  startAt: string;
  endAt: string;
  guestCount?: number;
  timezone?: string;
  meetingPoint?: string;
  message?: string;
};

export type UpdateBookingStatusInput = {
  status: BookingStatus;
  cancellationReason?: string;
};

export type CreateBookingReviewInput = {
  rating: number;
  comment?: string;
};

export type CreateBookingPaymentOrderInput = Record<string, never>;

export type VerifyBookingPaymentInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export type BookingPaymentOrder = {
  booking: Booking;
  payment: {
    provider: "RAZORPAY";
    keyId: string;
    orderId: string;
    amount: number;
    currency: string;
    merchantName: string;
    description: string;
    bookingStartAt: string;
    bookingEndAt: string;
    prefill: {
      name: string;
      email: string;
      contact: string | null;
    };
  };
};

export type CreateGuideAvailabilityBlockInput = {
  startAt: string;
  endAt: string;
  reason?: string;
};

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
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
  return readJson<HealthStatus>("/health");
}

export async function getCities() {
  const response = await readJson<{ items: City[] }>("/cities");
  return response?.items ?? [];
}

export async function getCity(slug: string) {
  const response = await readJson<{ item: CityDetail }>(
    `/cities/${encodeURIComponent(slug)}`,
  );

  return response?.item ?? null;
}

export async function getGuides(city?: string) {
  const search = city ? `?city=${encodeURIComponent(city)}` : "";
  const response = await readJson<{ items: Guide[] }>(`/guides${search}`);
  return response?.items ?? [];
}

export async function getGuide(guideId: string) {
  const response = await readJson<{ item: Guide }>(
    `/guides/${encodeURIComponent(guideId)}`,
  );

  return response?.item ?? null;
}

export async function getGuidesForLoggedInCity(token: string, city: string) {
  const response = await fetch(
    `${API_BASE_URL}/guides/discover?city=${encodeURIComponent(city)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
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

function readErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message: string | string[] }).message;
    return Array.isArray(message) ? message.join(", ") : message;
  }

  return "Request failed.";
}

export async function login(credentials: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const payload = (await response.json()) as
    | AuthSession
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload as AuthSession;
}

export async function loginWithGoogle(
  credential: string,
): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ credential }),
  });

  const payload = (await response.json()) as
    | AuthSession
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload as AuthSession;
}

export async function registerUser(
  input: UserRegistrationInput,
): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      role: "USER",
    }),
  });

  const payload = (await response.json()) as
    | AuthSession
    | { message: string | string[] };

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
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | AuthUser
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload as AuthUser;
}

export async function getAdminUsers(token: string) {
  const response = await fetch(`${API_BASE_URL}/auth/admin/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | { items: AdminUserRecord[] }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { items: AdminUserRecord[] }).items;
}

export async function registerGuide(
  input: GuideRegistrationInput,
): Promise<AuthSession> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      role: "GUIDE",
    }),
  });

  const payload = (await response.json()) as
    | AuthSession
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload as AuthSession;
}

export async function getGuidesForAdmin(
  token: string,
  status: GuideVerificationStatus = "PENDING",
) {
  const response = await fetch(
    `${API_BASE_URL}/guides/admin/review?status=${status}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as
    | { items: ReviewGuide[] }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { items: ReviewGuide[] }).items;
}

export async function getMyGuide(token: string) {
  const response = await fetch(`${API_BASE_URL}/guides/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | { item: Guide }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: Guide }).item;
}

export async function updateMyGuide(token: string, input: UpdateMyGuideInput) {
  const response = await fetch(`${API_BASE_URL}/guides/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as
    | { item: Guide }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: Guide }).item;
}

export async function getCitiesForAdmin(token: string) {
  const response = await fetch(`${API_BASE_URL}/cities/admin`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | { items: City[] }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { items: City[] }).items;
}

export async function createCity(token: string, input: CreateCityInput) {
  const response = await fetch(`${API_BASE_URL}/cities`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as
    | { item: City }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: City }).item;
}

export async function updateCityPlaces(
  token: string,
  cityId: string,
  places: NonNullable<CreateCityInput["places"]>,
) {
  const response = await fetch(`${API_BASE_URL}/cities/${cityId}/places`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ places }),
  });

  const payload = (await response.json()) as
    | { item: CityDetail }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: CityDetail }).item;
}

export async function updateCityImage(
  token: string,
  cityId: string,
  input: Pick<CreateCityInput, "imageBase64" | "imageMimeType">,
) {
  const response = await fetch(`${API_BASE_URL}/cities/${cityId}/image`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as
    | { item: CityDetail }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: CityDetail }).item;
}

export async function updateGuideVerification(
  token: string,
  guideId: string,
  status: Extract<GuideVerificationStatus, "APPROVED" | "REJECTED">,
) {
  const response = await fetch(
    `${API_BASE_URL}/guides/${guideId}/verification`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
  );

  const payload = (await response.json()) as
    | { item: Guide }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: Guide }).item;
}

export async function checkGuideAvailability(
  guideId: string,
  startAt: string,
  endAt: string,
) {
  const response = await fetch(
    `${API_BASE_URL}/guides/${guideId}/availability?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`,
    {
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as
    | { item: GuideAvailabilityCheck }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: GuideAvailabilityCheck }).item;
}

export async function updateGuideBookingPreference(
  token: string,
  acceptingBookings: boolean,
) {
  const response = await fetch(`${API_BASE_URL}/guides/me/booking-preference`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ acceptingBookings }),
  });

  const payload = (await response.json()) as
    | { item: Guide }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: Guide }).item;
}

export async function getMyGuideAvailabilityBlocks(token: string) {
  const response = await fetch(`${API_BASE_URL}/guides/me/availability-blocks`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | { items: GuideAvailabilityBlock[] }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { items: GuideAvailabilityBlock[] }).items;
}

export async function createGuideAvailabilityBlock(
  token: string,
  input: CreateGuideAvailabilityBlockInput,
) {
  const response = await fetch(`${API_BASE_URL}/guides/me/availability-blocks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as
    | { item: GuideAvailabilityBlock }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: GuideAvailabilityBlock }).item;
}

export async function deleteGuideAvailabilityBlock(
  token: string,
  blockId: string,
) {
  const response = await fetch(
    `${API_BASE_URL}/guides/me/availability-blocks/${blockId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const payload = (await response.json()) as
    | { success: boolean }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { success: boolean }).success;
}

export async function createBooking(token: string, input: CreateBookingInput) {
  const response = await fetch(`${API_BASE_URL}/bookings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as
    | Booking
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload as Booking;
}

export async function getMyBookings(token: string) {
  const response = await fetch(`${API_BASE_URL}/bookings/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as
    | { items: Booking[] }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { items: Booking[] }).items;
}

export async function updateBookingStatus(
  token: string,
  bookingId: string,
  input: UpdateBookingStatusInput,
) {
  const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as
    | Booking
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload as Booking;
}

export async function createBookingPaymentOrder(
  token: string,
  bookingId: string,
  input: CreateBookingPaymentOrderInput = {},
) {
  const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/payment-order`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as
    | { item: BookingPaymentOrder }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: BookingPaymentOrder }).item;
}

export async function verifyBookingPayment(
  token: string,
  bookingId: string,
  input: VerifyBookingPaymentInput,
) {
  const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/payment/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as
    | { item: Booking }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as { item: Booking }).item;
}

export async function createBookingReview(
  token: string,
  bookingId: string,
  input: CreateBookingReviewInput,
) {
  const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/review`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as
    | { item: BookingReview & { bookingId: string; guideProfileId: string; touristId: string } }
    | { message: string | string[] };

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return (payload as {
    item: BookingReview & {
      bookingId: string;
      guideProfileId: string;
      touristId: string;
    };
  }).item;
}
