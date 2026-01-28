import TourDetailClient from "./TourDetailClient";

export default async function TourDetailPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const { slotId } = await params;
  return <TourDetailClient slotId={slotId} />;
}
