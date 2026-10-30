import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

export async function enablePushNotifications(userId: string, language: string, zoneIds: number[]) {
  if (Platform.OS === 'web') throw new Error('Push alerts require the Android or iOS app on a physical device.');
  if (Constants.executionEnvironment === 'storeClient') throw new Error('Install a development or production build to enable push notifications.');
  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('farm-alerts', {
    name: 'Farm alerts', importance: Notifications.AndroidImportance.HIGH,
  });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Notifications are disabled. Allow notifications in device settings and try again.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('The Expo project ID is missing.');
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.from('push_devices').upsert({ token, user_id: userId, language }, { onConflict: 'token' });
  if (error) throw new Error(error.message);
  localStorage.setItem('geopulse_push_token', token);
  if (zoneIds.length) {
    const { error: subscriptionError } = await supabase.from('push_zone_subscriptions').upsert(zoneIds.map(zone_id => ({ user_id: userId, zone_id })), { onConflict: 'user_id,zone_id' });
    if (subscriptionError) throw new Error(subscriptionError.message);
  }
}

export async function disablePushNotifications() {
  const token = localStorage.getItem('geopulse_push_token');
  if (!token) return;
  const { error } = await supabase.from('push_devices').delete().eq('token', token);
  if (error) throw new Error(error.message);
  localStorage.removeItem('geopulse_push_token');
}
