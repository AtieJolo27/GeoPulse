import RecommendationCard from '@/components/RecommendationCard';

export default function RecommendedCrops({ crop_name, percentage, rank = 2, fontScale = 1 }: {
  crop_name: string;
  rank?: number;
  percentage: number;
  fontScale?: number;
}) {
  return <RecommendationCard name={crop_name} score={percentage} rank={rank} kind="crop" featured={false} fontScale={fontScale} />;
}
