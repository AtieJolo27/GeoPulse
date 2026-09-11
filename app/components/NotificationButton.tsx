import { computeSensorAlerts, type SensorAlert, type SensorReading } from '@/lib/sensorAlerts';
import { supabase } from '@/lib/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../lib/AppContext';
import UrgentCard from './UrgentCard';

export function NotificationButton() {
  const { t } = useApp();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<SensorAlert[]>([]);
  const loadAlerts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('sensor_readings').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
    setAlerts(computeSensorAlerts(data as SensorReading | null));
    setLoading(false);
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);
  const badgeLabel = alerts.length > 9 ? '9+' : String(alerts.length);

  return <>
    <TouchableOpacity onPress={() => { setVisible(true); loadAlerts(); }} activeOpacity={0.7} hitSlop={8} accessibilityRole="button" accessibilityLabel={alerts.length ? `${alerts.length} notifications. Open notifications` : 'Open notifications'} style={{ width: 36, height: 36, marginRight: 8, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="notifications-outline" size={23} color="#FFFFFF" />
      {alerts.length > 0 ? <View style={{ position: 'absolute', right: 1, top: 1, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#DC2626', borderWidth: 2, borderColor: '#1B5E37', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 }}><Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800', lineHeight: 12 }}>{badgeLabel}</Text></View> : null}
    </TouchableOpacity>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setVisible(false)}>
        <Pressable className="absolute rounded-3xl p-5" style={{ top: 66, right: 16, width: '88%', maxWidth: 420, maxHeight: 480, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 12 }} onPress={(event) => event.stopPropagation()}>
          <View className="flex-row items-center"><View className="flex-1 flex-row items-center pr-2"><Ionicons name="notifications-outline" size={24} color="#1B5E37" /><View className="ml-2 flex-1"><Text className="text-base font-extrabold" style={{ color: '#173D28' }}>{t('Notifications', 'Mga Notipikasyon')}</Text><Text className="text-xs" numberOfLines={2} style={{ color: '#5C6F63' }}>{t('Tap an alert to view its recommendation.', 'Pindutin ang alerto upang makita ang rekomendasyon.')}</Text></View></View><TouchableOpacity onPress={() => setVisible(false)} accessibilityRole="button" accessibilityLabel="Close notifications" hitSlop={8} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={24} color="#365443" /></TouchableOpacity></View>
          {loading ? <View className="items-center py-10"><ActivityIndicator color="#1B5E37" /></View> : alerts.length === 0 ? <View className="items-center py-9"><Ionicons name="checkmark-circle" size={34} color="#16A34A" /><Text className="mt-3 text-center text-sm" style={{ color: '#365443' }}>{t('No alerts - all sensors are within optimal range.', 'Walang alerto - lahat ng sensor ay nasa optimal na antas.')}</Text></View> : <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>{alerts.map((alert, index) => <UrgentCard key={`${alert.field}-${index}`} field={t(alert.field, alert.fieldTl)} message={t(alert.message, alert.messageTl)} date={t(alert.date, alert.dateTl)} severity={alert.severity} />)}</ScrollView>}
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}
