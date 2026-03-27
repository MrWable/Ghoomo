import { notFound } from 'next/navigation';
import { getCity } from '@/lib/api';
import { CityDetailClient } from '@/components/city-detail-client';

export const dynamic = 'force-dynamic';

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = await getCity(slug);

  if (!city) {
    notFound();
  }

  return <CityDetailClient initialCity={city} />;
}
