import RecommendationCard from '@/components/RecommendationCard';

export default function RecommendedCrops({ crop_name, percentage, fontScale = 1 }: {
  crop_name: string;
  percentage: number;
  fontScale?: number;
}) {
  return <RecommendationCard name={crop_name} score={percentage} kind="crop" featured={false} fontScale={fontScale} />;
}
