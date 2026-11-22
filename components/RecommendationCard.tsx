import { TutorialTarget } from '@/shared/appLib/TutorialContext';
import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import { getCropImage, getFertilizerImage } from '@/shared/appLib/cropImages';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Image, Text, TouchableOpacity, View } from 'react-native';

export default function RecommendationCard({ name, score, kind, rank, featured = false, fontScale = 1, zoneId, readingId, plantedCrop }: {
  rank?: number;
  plantedCrop?: string;
  zoneId?: number;
  readingId?: number | string;
  name: string;
  score: number;
  kind: 'crop' | 'fertilizer';
  featured?: boolean;
  fontScale?: number;
}) {
  const { t } = useApp();
  const colors = useThemeColors();
  const fs = (size: number) => Math.round(size * fontScale);
  const validScore = Number.isFinite(score) && score >= 0 && score <= 100;
  const scoreLabel = validScore ? `${score.toFixed(2)}%` : t('Unavailable', 'Hindi makuha');
  const href = kind === 'crop'
    ? { pathname: '/(drawer)/(tabs)/crop/reasoning' as const, params: { crop: name, zoneId, readingId } }
    : { pathname: '/(drawer)/(tabs)/fertilizer/reasoning' as const, params: { fertilizer: name, zoneId, readingId, plantedCrop } };

  const card = <Link href={href} asChild>
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} style={{ marginBottom: kind === 'crop' ? 0 : 14, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: featured ? colors.border : colors.cardBorder, backgroundColor: colors.cardBg, shadowColor: '#102D22', shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, shadowOpacity: 0.04, elevation: 1 }}>
      {featured && kind !== 'crop' && <Text style={{ fontSize: fs(12), fontWeight: '700', color: colors.subText, marginBottom: 12 }}>{t('Highest-ranked model suggestion', 'Nangungunang mungkahi ng modelo')}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Image source={kind === 'crop' ? getCropImage(name) : getFertilizerImage(name)} style={{ width: kind === 'crop' ? 64 : featured ? 68 : 52, height: kind === 'crop' ? 64 : featured ? 68 : 52, borderRadius: 16, backgroundColor: colors.cardBgAlt }} />
        <View style={{ flex: 1 }}>
          {kind === 'crop' && <Text style={{ fontSize: fs(12), fontWeight: '700', color: colors.greenText, marginBottom: 3 }}>{t('Rank', 'Ranggo')} {rank ?? (featured ? 1 : 2)}</Text>}
          <Text style={{ fontSize: fs(kind === 'crop' ? 19 : featured ? 22 : 16), fontWeight: '800', color: colors.text, textTransform: 'capitalize' }}>{name.replace(/_/g, ' ')}</Text>
          <Text style={{ marginTop: 6, fontSize: fs(12), color: colors.subText }}>{kind === 'crop' ? t('View crop details', 'Tingnan ang detalye') : `${t('Model score', 'Iskor ng modelo')}: ${scoreLabel}`}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
      </View>
      {featured && kind !== 'crop' && <>
        <Text style={{ marginTop: 14, fontSize: fs(13), lineHeight: fs(19), color: colors.subText }}>
          {t('A candidate to review. This score does not establish a fertilizer need, application rate, or expected yield benefit.', 'Patabang maaaring suriin. Hindi pinatutunayan ng iskor ang pangangailangan, dami ng ilalagay, o dagdag na ani.')}
        </Text>
        <Text style={{ marginTop: 12, fontSize: fs(13), fontWeight: '700', color: colors.greenText }}>{t('Review details', 'Suriin ang detalye')}</Text>
      </>}
    </TouchableOpacity>
  </Link>;
  return kind === 'crop' && rank === 1 ? <TutorialTarget id="crop-card">{card}</TutorialTarget> : card;
}
