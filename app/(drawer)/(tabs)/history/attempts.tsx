import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
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
    <Stack.Screen options={{ headerTitle: t('Previous attempts', 'Mga nakaraang attempt') }} />
    {valid ? <>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{zone ? t(zone.name_en, zone.name_tl) : `${t('Zone', 'Sona')} ${id}`}</Text>
      <Text style={{ color: colors.subText, marginTop: 8 }}>{t('Earlier completed tests, newest first. Showing history from the latest 20 attempts.', 'Mga nakaraang natapos na test, pinakabago muna. Kasaysayan mula sa pinakahuling 20 attempt.')}</Text>
      <SensorAttempts history zoneId={id} />
    </> : <Text style={{ color: colors.text }}>{zonesLoading ? t('Loading zones...', 'Nilo-load ang mga sona...') : t('Select a zone from the dashboard to view its previous attempts.', 'Pumili ng sona sa dashboard para makita ang mga nakaraang attempt.')}</Text>}
  </ScrollView>;
}
