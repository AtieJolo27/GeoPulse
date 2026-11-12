import { useApp } from '@/app/lib/AppContext';
import { enablePushNotifications } from '@/lib/pushNotifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

export default function PushNotificationBridge() {
  const { user, language, setActiveZoneId, zones, zonesLoading, loading } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!user || loading || zonesLoading || Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return;
    let disposed = false;
    let pending = false;
    const register = async () => {
      if (disposed || pending) return;
      pending = true;
      try {
        await enablePushNotifications(user.id, language, zones.map(zone => zone.id), true);
      } catch (error) {
        console.warn('Unable to automatically register push alerts:', error instanceof Error ? error.message : 'Unknown error');
      } finally { pending = false; }
    };
    void register();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void register(); });
    return () => { disposed = true; listener.remove(); };
  }, [user, loading, zonesLoading, language, zones]);
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
    })().catch(() => console.warn('Unable to initialize push notifications.'));
    return () => { disposed = true; remove(); };
  }, [user, zones, language, router, setActiveZoneId]);
  return null;
}
