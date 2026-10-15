import CropSuccessChart from '@/app/components/CropSuccessChart';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { useApp } from '@/app/lib/AppContext';
import { exportSoilHistoryPDF } from '@/app/lib/exportSoilPDF';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';


export default function History() {
  const { t, activeZoneId, zones } = useApp();
  const colors = useThemeColors();
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    try { setExporting(true); await exportSoilHistoryPDF(activeZoneId, zones.find(zone => zone.id === activeZoneId)?.name_en); }
    catch (error) { Alert.alert(t('Export failed', 'Hindi na-export'), error instanceof Error ? error.message : t('Unable to generate the soil report.', 'Hindi magawa ang soil report.')); }
    finally { setExporting(false); }
  };

  return (
    <ScrollView className="flex-1 px-5 pt-5" style={{ backgroundColor: colors.bg }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 105 }}>
      <Text style={{ color: colors.subText }}>{t('Harvest results', 'Mga resulta ng ani')}</Text>
      <Text className="mt-1" style={{ fontSize: 25, fontWeight: '800', color: colors.text }}>{t('Crop success rate', 'Antas ng tagumpay ng pananim')}</Text>
      <Text className="mt-2" style={{ fontSize: 13, lineHeight: 19, color: colors.subText }}>{t('Compare recorded harvest outcomes for the selected zone.', 'Ihambing ang mga naitalang resulta ng ani para sa napiling sona.')}</Text>

      <View className="mt-6 rounded-3xl border py-2" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}>
        <View className="px-3 pt-2"><SectionHeader title={t('Success by crop', 'Tagumpay ayon sa pananim')} subtitle={t('Recorded completed growing cycles', 'Mga naitalang natapos na pagtatanim')} /></View>
        <CropSuccessChart />
      </View>

      <TouchableOpacity onPress={handleExportPDF} disabled={exporting} className="mt-6 flex-row items-center justify-center rounded-2xl border px-4 py-4" style={{ borderColor: colors.border, backgroundColor: colors.cardBg, opacity: exporting ? 0.6 : 1 }}>
        <Ionicons name="document-text-outline" size={19} color={colors.primaryDark} />
        <Text className="ml-2 font-bold" style={{ color: colors.primaryDark }}>{exporting ? t('Preparing report...', 'Inihahanda ang report...') : t('Export sensor history PDF', 'I-export ang kasaysayan ng sensor sa PDF')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
