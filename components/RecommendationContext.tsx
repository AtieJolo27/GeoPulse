import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Text, View } from 'react-native';

export default function RecommendationContext({ createdAt, refreshFailed }: { createdAt?: string; refreshFailed: boolean }) {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const date = createdAt ? new Date(createdAt) : null;
  return <View style={{ marginBottom: 16, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 8 }}>
    <Text style={{ color: colors.subText, fontSize: 13 * fontScale, lineHeight: 19 * fontScale }}>
      {t('Model scores rank the options considered by the model. They are not verified suitability ratings or chances of success. A low score does not prove an option unsuitable.', 'Iniraranggo ng mga iskor ang mga opsyong sinuri ng modelo. Hindi ito napatunayang sukatan ng kaangkupan o tsansa ng tagumpay. Hindi patunay ang mababang iskor na hindi angkop ang isang opsyon.')}
    </Text>
    <Text style={{ color: colors.mutedText, fontSize: 12 * fontScale }}>
      {date && Number.isFinite(date.getTime())
        ? `${t('Prediction recorded', 'Naitalang prediksyon')}: ${date.toLocaleString()}`
        : t('Prediction date unavailable', 'Walang petsa ng prediksyon')}
    </Text>
    <Text style={{ color: colors.subText, fontSize: 12 * fontScale }}>
      {t('These results are not filtered to the selected zone. Check the source readings and crop context before using them.', 'Hindi nakasala sa napiling sona ang mga resultang ito. Suriin ang pinagmulang datos at pananim bago gamitin.')}
    </Text>
    {refreshFailed && <Text accessibilityRole="alert" style={{ color: colors.warning, fontSize: 12 * fontScale, fontWeight: '600' }}>
      {t('Refresh failed. Showing previously loaded results; they may be out of date. Pull down to retry.', 'Hindi na-refresh. Dating resulta ang ipinapakita at maaaring luma na. Hilahin pababa para subukang muli.')}
    </Text>}
  </View>;
}
