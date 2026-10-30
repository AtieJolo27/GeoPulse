import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabaseClient';
import { markNotificationsRead, readNotificationIds, readNotificationSnapshot, sensorNotifications, subscribeNotificationReadState } from '@/lib/notificationReadState';
import type { SensorReading } from '@/lib/sensorAlerts';
import { HeaderPopover } from './HeaderPopover';

export function NotificationButton() {
  const { t, activeZoneId, zones, user } = useApp();
  const colors = useThemeColors();
  const zone = zones.find(item => item.id === activeZoneId);
  const soilType = zone?.soil_type;
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ zoneId: number | null; reading: SensorReading | null; loading: boolean; error: string | null }>({ zoneId: null, reading: null, loading: true, error: null });
  useFocusEffect(useCallback(() => {
    void attempt;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const load = async () => {
      setState({ zoneId: activeZoneId, reading: null, loading: true, error: null });
      try {
        if (activeZoneId === null) {
          if (active) setState({ zoneId: null, reading: null, loading: false, error: null });
          return;
        }
        const { data, error } = await supabase.from('sensor_readings').select('*').eq('zone_id', activeZoneId)
          .order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
          .limit(1).abortSignal(controller.signal).maybeSingle();
        if (error) throw new Error(error.message);
        if (active) setState({ zoneId: activeZoneId, reading: data, loading: false, error: null });
      } catch (error) {
        if (active) setState({ zoneId: activeZoneId, reading: null, loading: false, error: controller.signal.aborted ? t('Notifications took too long. Please retry.', 'Matagal ang pagkuha ng notipikasyon. Subukan muli.') : error instanceof Error ? error.message : 'Unable to load notifications.' });
      } finally { clearTimeout(timeout); }
    };
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [activeZoneId, attempt, t]));
  const current = state.zoneId === activeZoneId ? state : null;
  const alerts = sensorNotifications(current?.reading ?? null, soilType);
  const count = alerts.length;
  const userId = user?.id ?? null;
  const snapshot = useSyncExternalStore(subscribeNotificationReadState, () => readNotificationSnapshot(userId, activeZoneId), () => '');
  const readIds = readNotificationIds(snapshot);
  const unreadCount = alerts.filter(alert => !readIds.includes(alert.id)).length;
  useEffect(() => {
    if (visible && current && !current.loading && !current.error) {
      markNotificationsRead(userId, activeZoneId, alerts.slice(0, 5).map(alert => alert.id));
    }
  }, [visible, current, alerts, userId, activeZoneId]);
  const router = useRouter();
  const pathname = usePathname();
  return <>
    <TouchableOpacity onPress={() => { setVisible(true); setAttempt(value => value + 1); }} activeOpacity={0.7} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Open notifications', 'Buksan ang mga notipikasyon')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="notifications-outline" size={23} color="#FFFFFF" />
      {unreadCount > 0 && <View style={{ position: 'absolute', right: 0, top: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}><Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>}
    </TouchableOpacity>
    <HeaderPopover visible={visible} onClose={() => setVisible(false)} title={t('Notifications', 'Mga Notipikasyon')} subtitle={zone ? t(zone.name_en, zone.name_tl) : t('Select a zone on Home.', 'Pumili ng sona sa Home.')} icon="notifications-outline" footer={count > 5 && !current?.loading ? <TouchableOpacity accessibilityRole="button" onPress={() => { setVisible(false); if (!pathname.endsWith('/notifications')) router.push('/(drawer)/(tabs)/home/notifications'); }} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 14, marginTop: 8, alignItems: 'center' }}><Text style={{ color: colors.greenText, fontWeight: '800' }}>{t('View all Notifications', 'Tingnan ang lahat ng Notipikasyon')}</Text></TouchableOpacity> : undefined}>
      {!current || current.loading ? <View style={{ padding: 26, alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View> : current.error ? <View style={{ gap: 8, paddingVertical: 12 }}><Text accessibilityRole="alert" style={{ color: colors.subText }}>{current.error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={{ paddingVertical: 10 }}><Text style={{ color: colors.greenText, fontWeight: '700' }}>{t('Retry', 'Subukan muli')}</Text></TouchableOpacity></View> : alerts.length === 0 ? <Text style={{ color: colors.subText, paddingVertical: 18 }}>{!zone ? t('Select a zone to view alerts.', 'Pumili ng sona para makita ang mga alerto.') : !current.reading ? t('No readings for this zone yet.', 'Wala pang datos para sa sonang ito.') : t('No alerts. Readings are within the alert thresholds.', 'Walang alerto. Nasa saklaw ang mga datos.')}</Text> : alerts.slice(0, 5).map(alert => <View key={alert.field} style={{ flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}>
        <Ionicons name={alert.urgent ? 'alert-circle-outline' : 'warning-outline'} size={21} color={alert.urgent ? colors.danger : colors.warning} />
        <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.text, fontWeight: '800', textTransform: 'capitalize' }}>{alert.field}</Text><Text numberOfLines={3} style={{ color: colors.subText, fontSize: 12, lineHeight: 17 }}>{alert.message}</Text>{current.reading?.created_at && <Text style={{ color: colors.mutedText, fontSize: 10 }}>{new Date(current.reading.created_at).toLocaleString()}</Text>}</View>
      </View>)}
    </HeaderPopover>
  </>;
}
