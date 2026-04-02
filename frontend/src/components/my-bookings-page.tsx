'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  createBookingPaymentOrder,
  getCurrentUser,
  getMyBookings,
  verifyBookingPayment,
  type AuthUser,
  type Booking,
  type BookingStatus,
  type PaymentStatus,
} from '@/lib/api';
import { clearSession, getStoredSession } from '@/lib/auth';

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void) => void;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
  handler?: (response: RazorpaySuccessResponse) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function formatDateTime(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Not scheduled';
}

function formatCurrency(amount: number | null) {
  return amount == null
    ? 'Quoted later'
    : `INR ${amount.toLocaleString('en-IN')}`;
}

function formatBookingStatusLabel(status: BookingStatus) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPaymentStatusLabel(status: PaymentStatus) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sortBookings(bookings: Booking[]) {
  const statusOrder: Record<BookingStatus, number> = {
    CONFIRMED: 0,
    PENDING: 1,
    IN_PROGRESS: 2,
    COMPLETED: 3,
    NO_SHOW: 4,
    CANCELLED: 5,
    REJECTED: 6,
  };

  return [...bookings].sort((left, right) => {
    const leftOrder = statusOrder[left.status];
    const rightOrder = statusOrder[right.status];

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
  });
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const className =
    status === 'PENDING'
      ? 'warning-badge'
      : status === 'CONFIRMED' || status === 'IN_PROGRESS'
        ? 'status-badge'
        : status === 'COMPLETED'
          ? 'tag-soft'
          : 'border border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error-text)]';

  return (
    <span className={`${className} rounded-full px-3 py-1 text-xs font-semibold`}>
      {formatBookingStatusLabel(status)}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const className =
    status === 'PAID'
      ? 'status-badge'
      : status === 'ORDER_CREATED'
        ? 'warning-badge'
        : status === 'FAILED'
          ? 'border border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error-text)]'
          : 'tag-soft';

  return (
    <span className={`${className} rounded-full px-3 py-1 text-xs font-semibold`}>
      {formatPaymentStatusLabel(status)}
    </span>
  );
}

export function MyBookingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRazorpayReady, setIsRazorpayReady] = useState(false);
  const [activePaymentBookingId, setActivePaymentBookingId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function load() {
      const session = getStoredSession();

      if (!session) {
        router.replace('/login?next=/bookings');
        return;
      }

      if (session.user.role === 'ADMIN') {
        router.replace('/admin');
        return;
      }

      if (session.user.role === 'GUIDE') {
        router.replace('/guides');
        return;
      }

      try {
        const [nextUser, nextBookings] = await Promise.all([
          getCurrentUser(session.accessToken),
          getMyBookings(session.accessToken),
        ]);

        if (!isActive) {
          return;
        }

        setUser(nextUser);
        setBookings(sortBookings(nextBookings));
        setError(null);
      } catch (loadError) {
        clearSession();

        if (!isActive) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : 'Unable to load bookings.',
        );
        router.replace('/login?next=/bookings');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [router]);

  function handleLogout() {
    clearSession();
    router.replace('/');
    router.refresh();
  }

  async function handlePayNow(booking: Booking) {
    const session = getStoredSession();

    if (!session) {
      router.push('/login?next=/bookings');
      return;
    }

    if (!window.Razorpay || !isRazorpayReady) {
      setError('Payment window is still loading. Try again in a moment.');
      return;
    }

    setActivePaymentBookingId(booking.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const order = await createBookingPaymentOrder(session.accessToken, booking.id);

      const razorpay = new window.Razorpay({
        key: order.payment.keyId,
        amount: order.payment.amount,
        currency: order.payment.currency,
        name: order.payment.merchantName,
        description: order.payment.description,
        order_id: order.payment.orderId,
        prefill: {
          name: order.payment.prefill.name,
          email: order.payment.prefill.email,
          contact: order.payment.prefill.contact ?? undefined,
        },
        notes: {
          bookingId: booking.id,
        },
        theme: {
          color: '#d95f1f',
        },
        modal: {
          ondismiss: () => {
            setActivePaymentBookingId(null);
          },
        },
        handler: (response) => {
          void (async () => {
            try {
              const verifiedBooking = await verifyBookingPayment(
                session.accessToken,
                booking.id,
                {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                },
              );

              setBookings((current) =>
                sortBookings(
                  current.map((currentBooking) =>
                    currentBooking.id === booking.id
                      ? verifiedBooking
                      : currentBooking,
                  ),
                ),
              );
              setSuccessMessage('Payment verified. Your booking is now marked as paid.');
              setError(null);
            } catch (verificationError) {
              setError(
                verificationError instanceof Error
                  ? verificationError.message
                  : 'Unable to verify this payment.',
              );
            } finally {
              setActivePaymentBookingId(null);
            }
          })();
        },
      });

      razorpay.on('payment.failed', (response) => {
        setError(
          response.error?.description ?? 'Payment failed. Please try again.',
        );
        setActivePaymentBookingId(null);
      });

      razorpay.open();
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : 'Unable to start payment right now.',
      );
      setActivePaymentBookingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="glass-panel rounded-[36px] p-8 md:p-10">
        <p className="eyebrow">My bookings</p>
        <h1 className="section-title mt-4 text-[2.4rem]">Loading traveller bookings</h1>
        <p className="mt-4 text-base text-[var(--muted)]">
          Fetching your confirmed, pending, and completed guide requests.
        </p>
      </div>
    );
  }

  const payableBookings = bookings.filter(
    (booking) =>
      booking.status === 'CONFIRMED' &&
      booking.paymentStatus !== 'PAID' &&
      booking.totalAmount != null,
  );
  const paidBookings = bookings.filter((booking) => booking.paymentStatus === 'PAID');

  return (
    <div className="space-y-8">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setIsRazorpayReady(true)}
      />

      <header className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-[32px] px-5 py-3">
        <Link href="/" className="font-mono text-sm uppercase tracking-[0.2em]">
          Ghoomo
        </Link>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
          <Link href="/">Home</Link>
          <button type="button" onClick={handleLogout} className="font-semibold">
            Logout
          </button>
        </div>
      </header>

      <section className="glass-panel rounded-[36px] p-8 md:p-10">
        <p className="eyebrow">Traveller bookings</p>
        <h1 className="section-title mt-4 text-[2.6rem]">
          Manage bookings and pay after guide confirmation
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
          Once a guide accepts your request, payment becomes available here. The booking
          remains in your list before and after payment so you can track its service status.
        </p>

        {successMessage ? (
          <div className="message-success mt-6 rounded-2xl px-4 py-3 text-sm">
            {successMessage}
          </div>
        ) : null}

        {error ? (
          <div className="message-error mt-6 rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Account
            </p>
            <p className="mt-2 text-lg font-semibold">{user?.fullName ?? 'Traveller'}</p>
          </div>
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Total bookings
            </p>
            <p className="mt-2 text-lg font-semibold">{bookings.length}</p>
          </div>
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Payable now
            </p>
            <p className="mt-2 text-lg font-semibold">{payableBookings.length}</p>
          </div>
          <div className="panel-tint rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Paid bookings
            </p>
            <p className="mt-2 text-lg font-semibold">{paidBookings.length}</p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-[28px] border border-[var(--line)]">
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="bg-[var(--surface-pill)] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Guide</th>
                  <th className="px-4 py-3 font-semibold">City</th>
                  <th className="px-4 py-3 font-semibold">Slot</th>
                  <th className="px-4 py-3 font-semibold">Booking</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length > 0 ? (
                  bookings.map((booking) => {
                    const canPay =
                      booking.status === 'CONFIRMED' &&
                      booking.paymentStatus !== 'PAID' &&
                      booking.totalAmount != null;
                    const isPaying = activePaymentBookingId === booking.id;

                    return (
                      <tr
                        key={booking.id}
                        className="border-t border-[var(--line)] align-top"
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold">{booking.guide.fullName}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {booking.guide.email}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-[var(--muted)]">
                          {booking.guide.city}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium">{formatDateTime(booking.startAt)}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Until {formatDateTime(booking.endAt)}
                          </p>
                          {booking.meetingPoint ? (
                            <p className="mt-2 text-xs text-[var(--muted)]">
                              Meet: {booking.meetingPoint}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <BookingStatusBadge status={booking.status} />
                        </td>
                        <td className="px-4 py-4">
                          <PaymentStatusBadge status={booking.paymentStatus} />
                          {booking.paymentPaidAt ? (
                            <p className="mt-2 text-xs text-[var(--muted)]">
                              Paid on {formatDateTime(booking.paymentPaidAt)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-[var(--muted)]">
                          {formatCurrency(booking.totalAmount)}
                        </td>
                        <td className="px-4 py-4">
                          {canPay ? (
                            <button
                              type="button"
                              onClick={() => void handlePayNow(booking)}
                              disabled={isPaying || !isRazorpayReady}
                              className="button-primary rounded-full px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {isPaying ? 'Opening payment...' : 'Pay now'}
                            </button>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">
                              {booking.paymentStatus === 'PAID'
                                ? 'Payment completed'
                                : booking.status === 'PENDING'
                                  ? 'Waiting for guide'
                                  : 'No payment action'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-[var(--muted)]"
                    >
                      No traveller bookings yet. Start from a city page and request a guide.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
