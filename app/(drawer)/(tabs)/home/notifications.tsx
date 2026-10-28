import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { LoadingSkeleton } from '@/app/components/LoadingSkeleton';
import UrgentCard from '@/app/components/UrgentCard';
import { supabase } from '@/lib/supabaseClient';
import { classifySoilValue, getSoilTypeRanges } from '@/lib/soilTypeRanges';
import { SENSOR_REFERENCE_RANGES } from '@/lib/soilHealthScore';
import type { SensorReading } from '@/lib/sensorAlerts';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationsScreen() {
  const { t, fontScale, zones, activeZoneId, zonesLoading } = useApp();
  const colors = useThemeColors();
  const zone = zones.find(item => item.id === activeZoneId);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ zoneId: number | null; loading: boolean; reading: SensorReading | null; error: string | null }>({ zoneId: null, loading: true, reading: null, error: null });
  useFocusEffect(useCallback(() => {
    // A retry starts a new request even when the selected zone is unchanged.
    void attempt;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const load = async () => {
      setState({ zoneId: activeZoneId, loading: true, reading: null, error: null });
      try {
        if (activeZoneId === null) {
          if (active) setState({ zoneId: null, loading: false, reading: null, error: null });
          return;
        }
        const { data, error } = await supabase.from('sensor_readings').select('*').eq('zone_id', activeZoneId)
          .order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
          .limit(1).abortSignal(controller.signal).maybeSingle();
        if (error) throw new Error(error.message);
        if (active) setState({ zoneId: activeZoneId, loading: false, reading: data, error: null });
      } catch (error) {
        if (active) setState({ zoneId: activeZoneId, loading: false, reading: null, error: controller.signal.aborted ? 'Notifications took too long to load. Please retry.' : error instanceof Error ? error.message : 'Unable to load notifications.' });
      } finally { clearTimeout(timeout); }
    };
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [activeZoneId, attempt]));
  const current = state.zoneId === activeZoneId ? state : null;
  const loading = zonesLoading || !current || current.loading;
  const refresh = () => setAttempt(value => value + 1);
  const ranges = { ...SENSOR_REFERENCE_RANGES, ...getSoilTypeRanges(zone?.soil_type) };
  const alerts = current?.reading ? (Object.keys(SENSOR_REFERENCE_RANGES) as (keyof typeof SENSOR_REFERENCE_RANGES)[]).flatMap(key => {
    const value = current.reading![key];
    const result = classifySoilValue(value, ranges[key]);
    if (result.level !== 'low' && result.level !== 'high') return [];
    return [{ field: key.replace(/_/g, ' '), message: `${value} ${ranges[key].unit} - ${result.level}${result.risk ? `. ${result.risk}` : ''}.`, severity: result.risk ? 'high' as const : 'medium' as const }];
  }) : [];
  const date = current?.reading?.created_at ? new Date(current.reading.created_at).toLocaleString() : '';
  return <>
    <Stack.Screen options={{ headerTitle: t('Notifications', 'Mga Notipikasyon') }} />
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 24, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}>
      <Text style={{ color: colors.text, fontSize: 22 * fontScale, fontWeight: '800', marginBottom: 8 }}>{t('Notifications', 'Mga Notipikasyon')}</Text>
      <Text style={{ color: colors.subText, marginBottom: 20 }}>{zone ? t(zone.name_en, zone.name_tl) : t('Select a zone on the dashboard.', 'Pumili ng sona sa dashboard.')}</Text>
      {loading ? <View accessibilityLabel={t('Loading notifications', 'Kinukuha ang mga notipikasyon')} accessibilityState={{ busy: true }} style={{ gap: 12 }}>
        {[1, 2, 3].map(item => <LoadingSkeleton key={item} height={100} borderRadius={16} />)}
      </View> : current?.error ? <View>
        <Text accessibilityRole="alert" style={{ color: colors.subText }}>{current.error}</Text>
        <TouchableOpacity onPress={refresh} accessibilityRole="button" style={{ paddingVertical: 16 }}><Text style={{ color: colors.greenText, fontWeight: '700' }}>{t('Retry', 'Subukan muli')}</Text></TouchableOpacity>
      </View> : !zone ? null : !current?.reading ? <Text style={{ color: colors.subText }}>{t('No sensor readings are linked to this zone yet.', 'Wala pang datos ng sensor sa sonang ito.')}</Text> : alerts.length === 0 ? <Text style={{ color: colors.subText }}>{t('No alerts. Available readings are within the alert thresholds.', 'Walang alerto. Nasa saklaw ng batayan ang mga available na datos.')}</Text> : alerts.map(alert => <UrgentCard key={alert.field} field={alert.field} message={alert.message} date={date} severity={alert.severity} />)}
    </ScrollView>
  </>;
}
