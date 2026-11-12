import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import * as Linking from 'expo-linking';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

export type FertilizerSource = { title: string; publisher: string; url: string; supports: string };

export default function FertilizerEvidence({ inDataset, sources = [] }: { inDataset?: boolean; sources?: FertilizerSource[] }) {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  if (inDataset === undefined && !sources.length) return null;
  return <View style={{ marginTop: 10, gap: 8 }}>
    <Text style={{ color: colors.subText, fontWeight: '700', fontSize: 12 * fontScale }}>{inDataset === undefined ? t('References', 'Mga sanggunian') : inDataset ? t('Included in dataset', 'Kasama sa dataset') : t('Cited alternative outside dataset', 'Alternatibong may sanggunian sa labas ng dataset')}</Text>
    {sources.map(source => <View key={source.url}>
      <TouchableOpacity accessibilityRole="link" accessibilityLabel={`${source.publisher}: ${source.title}`} onPress={() => {
        void Linking.openURL(source.url).catch(() => Alert.alert(t('Unable to open source', 'Hindi mabuksan ang sanggunian'), t('Please try again.', 'Subukan muli.')));
      }} style={{ paddingVertical: 10 }}>
        <Text style={{ color: colors.greenText, fontSize: 13 * fontScale, textDecorationLine: 'underline' }}>{source.publisher}: {source.title}</Text>
      </TouchableOpacity>
      <Text style={{ color: colors.subText, fontSize: 12 * fontScale, lineHeight: 18 * fontScale }}>{source.supports}</Text>
    </View>)}
    {!!sources.length && <Text style={{ color: colors.mutedText, fontSize: 11 * fontScale }}>{t('Sources support nutrient content, not the app reference targets or a field application rate.', 'Batayan ang mga sanggunian para sa sustansiya, hindi para sa target ng app o dami ng ilalagay sa bukid.')}</Text>}
  </View>;
}
