import NutrientHistoryChart from '@/app/components/HistoryChart';
import SoilHealthChart from '@/app/components/SoilHealthChart';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { useApp } from '@/app/lib/AppContext';
import { exportSoilHistoryPDF } from '@/app/lib/exportSoilPDF';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type ChartMode = 'health' | 'soil';

export default function History() {
  const { t } = useApp();
  const colors = useThemeColors();
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState<ChartMode>('health');

  const handleExportPDF = async () => {
    try { setExporting(true); await exportSoilHistoryPDF(); }
    catch { Alert.alert(t('Export failed', 'Hindi na-export'), t('Unable to generate the soil report.', 'Hindi magawa ang soil report.')); }
    finally { setExporting(false); }
  };

  return (
    <ScrollView className="flex-1 px-5 pt-5" style={{ backgroundColor: colors.bg }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 105 }}>
      <Text style={{ color: colors.subText }}>Field history</Text>
      <Text className="mt-1" style={{ fontSize: 25, fontWeight: '800', color: colors.text }}>{t('Is your soil improving?', 'Gumaganda ba ang inyong lupa?')}</Text>
      <Text className="mt-2" style={{ fontSize: 13, lineHeight: 19, color: colors.subText }}>{t('Review one trend at a time to spot changes clearly.', 'Suriin ang isang trend sa bawat pagkakataon para madaling makita ang pagbabago.')}</Text>

      <View className="mt-6 flex-row rounded-2xl p-1" style={{ backgroundColor: colors.cardBgAlt }}>
        {([['health', t('Soil health', 'Kalusugan ng lupa')], ['soil', t('Nutrients & soil', 'Nutrients at lupa')]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => setMode(key)} className="flex-1 rounded-xl px-3 py-3" style={{ backgroundColor: mode === key ? colors.cardBg : 'transparent' }}>
            <Text numberOfLines={1} className="text-center text-xs font-bold" style={{ color: mode === key ? colors.primaryDark : colors.subText }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="mt-6 rounded-3xl border py-2" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}>
        <View className="px-3 pt-2"><SectionHeader title={mode === 'health' ? t('Soil health trend', 'Trend ng kalusugan ng lupa') : t('Soil data trend', 'Trend ng soil data')} subtitle={t('Tap a point to see its reading.', 'I-tap ang point para makita ang reading.')} /></View>
        {mode === 'health' ? <SoilHealthChart /> : <NutrientHistoryChart />}
      </View>

      <TouchableOpacity onPress={handleExportPDF} disabled={exporting} className="mt-6 flex-row items-center justify-center rounded-2xl border px-4 py-4" style={{ borderColor: colors.border, backgroundColor: colors.cardBg, opacity: exporting ? 0.6 : 1 }}>
        <Ionicons name="document-text-outline" size={19} color={colors.primaryDark} />
        <Text className="ml-2 font-bold" style={{ color: colors.primaryDark }}>{exporting ? t('Preparing report...', 'Inihahanda ang report...') : t('Export PDF report', 'I-export ang PDF report')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
