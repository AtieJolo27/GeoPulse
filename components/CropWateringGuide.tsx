import { useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import type { CropMoistureRange } from '@/lib/cropMoisture';
import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';

export default function CropWateringGuide({ crop, soilType, range, loading, failed }: {
  crop?: string | null; soilType?: string | null; range: CropMoistureRange | null; loading: boolean; failed: boolean;
}) {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const [linkFailed, setLinkFailed] = useState(false);
  return <View style={{ padding: 18, marginBottom: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.cardBg, gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: '800', fontSize: 18 * fontScale }}>{t('Crop moisture requirement', 'Kinakailangang halumigmig ng pananim')}</Text>
    {!!crop && <Text style={{ color: colors.greenText, textTransform: 'capitalize', fontWeight: '700' }}>{crop.replace(/_/g, ' ')}{soilType ? ` / ${soilType}` : ''}</Text>}
    {range ? <>
      <Text style={{ color: colors.greenText, fontWeight: '800', fontSize: 26 * fontScale }}>{range.min.toFixed(1)}% - {range.max.toFixed(1)}%</Text>
      <Text style={{ color: colors.subText, fontSize: 12 * fontScale }}>{t('Dataset range for this crop and soil type', 'Saklaw sa dataset para sa pananim at uri ng lupa')}</Text>
      <Text style={{ color: colors.text, fontSize: 14 * fontScale, lineHeight: 21 * fontScale }}>{range.wateringGuide}</Text>
      {!!range.source && <Text style={{ color: colors.subText, fontSize: 12 * fontScale }}>{t('Moisture source recorded in dataset', 'Sanggunian ng moisture sa dataset')}: {range.source}</Text>}
      <Text style={{ color: colors.subText, fontSize: 12 * fontScale }}>{t('Compare with calibrated soil-moisture measurements on the same percentage basis.', 'Ihambing sa calibrated na sukat ng lupa na may parehong batayan ng porsiyento.')}</Text>
      {!!range.sourceUrl && <TouchableOpacity accessibilityRole="link" onPress={() => { setLinkFailed(false); void Linking.openURL(range.sourceUrl).catch(() => setLinkFailed(true)); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.greenText, textDecorationLine: 'underline', fontSize: 12 * fontScale }}>{range.sourceTitle || t('Read watering guide source', 'Basahin ang sanggunian sa patubig')}</Text></TouchableOpacity>}
    </> : <Text style={{ color: colors.subText, fontSize: 14 * fontScale, lineHeight: 21 * fontScale }}>{!crop ? t('Set the planted crop on Home to see its moisture range.', 'Itakda ang pananim sa Home para sa saklaw ng moisture.') : !soilType ? t('Set the zone soil type to select the correct crop range.', 'Itakda ang uri ng lupa para sa wastong saklaw.') : failed ? t('Unable to load the moisture dataset. Reopen this tab to retry.', 'Hindi ma-load ang dataset. Buksan muli ang tab upang subukang muli.') : loading ? t('Loading crop requirements...', 'Kinukuha ang pangangailangan...') : t('No range is listed for this crop and soil combination. Select the correct soil type on Home.', 'Walang saklaw para sa kombinasyon ng pananim at lupa. Piliin ang wastong uri ng lupa sa Home.')}</Text>}
    {linkFailed && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t('Unable to open the source. Please try again.', 'Hindi mabuksan ang sanggunian. Subukan muli.')}</Text>}
  </View>;
}
