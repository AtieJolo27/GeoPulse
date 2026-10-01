import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { getCropImage, getFertilizerImage } from '@/app/lib/cropImages';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Image, Text, TouchableOpacity, View } from 'react-native';

export default function RecommendationCard({ name, score, kind, featured = false, fontScale = 1, zoneId, readingId }: {
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
    : { pathname: '/(drawer)/(tabs)/fertilizer/reasoning' as const, params: { fertilizer: name, zoneId, readingId } };

  return <Link href={href} asChild>
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} style={{ marginBottom: 12, padding: featured ? 20 : 16, borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardBg }}>
      {featured && <Text style={{ fontSize: fs(12), fontWeight: '700', color: colors.subText, marginBottom: 12 }}>{t('Highest-ranked model suggestion', 'Nangungunang mungkahi ng modelo')}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Image source={kind === 'crop' ? getCropImage(name) : getFertilizerImage(name)} style={{ width: 48, height: 48, borderRadius: 24 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fs(featured ? 22 : 16), fontWeight: '800', color: colors.text, textTransform: 'capitalize' }}>{name.replace(/_/g, ' ')}</Text>
          <Text style={{ marginTop: 6, fontSize: fs(12), color: colors.subText }}>{t('Model score', 'Iskor ng modelo')}: {scoreLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
      </View>
      {featured && <>
        <Text style={{ marginTop: 14, fontSize: fs(13), lineHeight: fs(19), color: colors.subText }}>
          {kind === 'crop'
            ? t('A candidate to evaluate. This score does not establish field suitability or predict harvest success.', 'Pananim na maaaring suriin. Hindi pinatutunayan ng iskor ang kaangkupan sa bukid o tagumpay ng ani.')
            : t('A candidate to review. This score does not establish a fertilizer need, application rate, or expected yield benefit.', 'Patabang maaaring suriin. Hindi pinatutunayan ng iskor ang pangangailangan, dami ng ilalagay, o dagdag na ani.')}
        </Text>
        <Text style={{ marginTop: 12, fontSize: fs(13), fontWeight: '700', color: colors.greenText }}>{t('Review details', 'Suriin ang detalye')}</Text>
      </>}
    </TouchableOpacity>
  </Link>;
}
