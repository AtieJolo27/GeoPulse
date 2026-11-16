import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import SensorAttempts from '@/components/SensorAttempts';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text } from 'react-native';

export default function PreviousAttemptsScreen() {
  const { zoneId } = useLocalSearchParams<{ zoneId?: string | string[] }>();
  const { zones, activeZoneId, zonesLoading, t } = useApp();
  const colors = useThemeColors();
  const routeId = Number(Array.isArray(zoneId) ? zoneId[0] : zoneId);
  const id = Number.isSafeInteger(routeId) && routeId > 0 ? routeId : activeZoneId;
  const valid = id !== null && Number.isSafeInteger(id) && id > 0;
  const zone = zones.find(item => item.id === id);
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
    <Stack.Screen options={{ headerTitle: t('Saved soil tests', 'Mga naka-save na test ng lupa') }} />
    {valid ? <>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{zone ? t(zone.name_en, zone.name_tl) : `${t('Zone', 'Sona')} ${id}`}</Text>
      <Text style={{ color: colors.subText, marginTop: 8 }}>{t('Completed tests, newest first. Tap View test averages to see a result. Showing completed tests from the latest 20 tests.', 'Mga natapos na test, pinakabago muna. Pindutin ang Tingnan ang average ng test para makita ang resulta. Mula sa pinakahuling 20 test.')}</Text>
      <SensorAttempts history zoneId={id} />
    </> : <Text style={{ color: colors.text }}>{zonesLoading ? t('Loading zones...', 'Nilo-load ang mga sona...') : t('Select a zone from the dashboard to view its previous attempts.', 'Pumili ng sona sa dashboard para makita ang mga nakaraang attempt.')}</Text>}
  </ScrollView>;
}
