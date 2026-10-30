import { useApp } from '@/app/lib/AppContext';
import { supabase } from '@/lib/supabaseClient';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function PushNotificationBridge() {
  const { user, language, setActiveZoneId, zones } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!user || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return;
    let disposed = false;
    let remove = () => {};
    void (async () => {
      const Notifications = await import('expo-notifications');
      if (disposed) return;
      Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
      const handle = (response: import('expo-notifications').NotificationResponse) => {
        const data = response.notification.request.content.data ?? {};
        const zoneId = Number(data.zone_id);
        if (!zones.some(zone => zone.id === zoneId)) return;
        void setActiveZoneId(zoneId);
        router.push(data.screen === 'calendar' ? '/(drawer)/(tabs)/history/histories' : '/(drawer)/(tabs)/home/notifications');
        void Notifications.clearLastNotificationResponseAsync();
      };
      const subscription = Notifications.addNotificationResponseReceivedListener(handle);
      remove = () => subscription.remove();
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!disposed && last) handle(last);
      const token = localStorage.getItem('geopulse_push_token');
      if (token && !disposed) {
        const { error } = await supabase.from('push_devices').update({ language }).eq('token', token).eq('user_id', user.id);
        if (error) console.warn('Unable to refresh push preferences.');
        if (zones.length) {
          const result = await supabase.from('push_zone_subscriptions').upsert(zones.map(zone => ({ user_id: user.id, zone_id: zone.id })), { onConflict: 'user_id,zone_id' });
          if (result.error) console.warn('Unable to refresh moisture subscriptions.');
        }
      }
    })().catch(() => console.warn('Unable to initialize push notifications.'));
    return () => { disposed = true; remove(); };
  }, [user, zones, language, router, setActiveZoneId]);
  return null;
}
