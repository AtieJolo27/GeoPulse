import RecommendationCard from '@/components/RecommendationCard';

export default function BestFertilizer({ fertilizer_name, percentage, fontScale = 1 }: {
  fertilizer_name: string;
  percentage: number;
  fontScale?: number;
}) {
  return <RecommendationCard name={fertilizer_name} score={percentage} kind="fertilizer" featured={true} fontScale={fontScale} />;
}
