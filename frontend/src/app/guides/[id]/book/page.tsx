import { notFound } from 'next/navigation';
import { GuideBookingPage } from '@/components/guide-booking-page';
import { getGuide } from '@/lib/api';

export const dynamic = 'force-dynamic';

type GuideBookingRouteProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    city?: string;
  }>;
};

export default async function GuideBookingRoute({
  params,
  searchParams,
}: GuideBookingRouteProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const guide = await getGuide(id);

  if (!guide) {
    notFound();
  }

  const citySlug = resolvedSearchParams?.city;
  const returnPath = citySlug ? `/guides/${id}/book?city=${citySlug}` : `/guides/${id}/book`;

  return (
    <GuideBookingPage
      citySlug={citySlug}
      guide={guide}
      returnPath={returnPath}
    />
  );
}
