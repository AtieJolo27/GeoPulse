import { useApp } from '@/app/lib/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabaseClient';
import { classifySoilValue, getSoilTypeRanges } from '@/lib/soilTypeRanges';
import { SENSOR_REFERENCE_RANGES } from '@/lib/soilHealthScore';

export function NotificationButton() {
  const { t, activeZoneId, zones } = useApp();
  const soilType = zones.find(zone => zone.id === activeZoneId)?.soil_type;
  const [badge, setBadge] = useState<{ zoneId: number; count: number } | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const load = async () => {
      if (activeZoneId === null) return;
      try {
        const { data, error } = await supabase.from('sensor_readings').select('*').eq('zone_id', activeZoneId)
          .order('created_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
          .limit(1).abortSignal(controller.signal).maybeSingle();
        if (error) throw error;
        const ranges = { ...SENSOR_REFERENCE_RANGES, ...getSoilTypeRanges(soilType) };
        const count = data ? (Object.keys(SENSOR_REFERENCE_RANGES) as (keyof typeof SENSOR_REFERENCE_RANGES)[]).filter(key => {
          const { level } = classifySoilValue(data[key], ranges[key]);
          return level === 'low' || level === 'high';
        }).length : 0;
        if (active) setBadge({ zoneId: activeZoneId, count });
      } catch {
        if (active) setBadge(null);
      } finally { clearTimeout(timeout); }
    };
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [activeZoneId, soilType]));
  const count = badge?.zoneId === activeZoneId ? badge.count : 0;
  const router = useRouter();
  const pathname = usePathname();
  return <TouchableOpacity
    onPress={() => { if (!pathname.endsWith('/notifications')) router.push('/(drawer)/(tabs)/home/notifications'); }}
    activeOpacity={0.7} hitSlop={8} accessibilityRole="button"
    accessibilityLabel={t('Open notifications', 'Buksan ang mga notipikasyon')}
    style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name="notifications-outline" size={23} color="#FFFFFF" />
    {count > 0 && <View style={{ position: 'absolute', right: 0, top: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{count > 9 ? '9+' : count}</Text>
    </View>}
  </TouchableOpacity>;
}
