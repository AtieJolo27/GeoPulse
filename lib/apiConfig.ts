import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Returns the correct base URL for API calls depending on the platform.
 *
 * - Web: relative URL works fine (e.g., `/api/groq`)
 * - iOS / Android (Expo Go / dev build): needs absolute URL to local server.
 *
 * In development, Expo's Metro server runs on your machine's LAN IP.
 * We use Constants.expoConfig?.hostUri which gives us "192.168.x.x:8081".
 * Release APKs use EXPO_PUBLIC_GROQ_API_URL (the EAS Hosting base URL).
 */
export function getApiBaseUrl(): string {
  // Groq's Expo API route is hosted independently of the Render backend.
  const hostedUrl = process.env.EXPO_PUBLIC_GROQ_API_URL?.trim().replace(/\/+$/, '');
  if (hostedUrl) {
    const url = new URL(hostedUrl);
    if (url.protocol !== 'https:') throw new Error('The hosted Groq API must use HTTPS.');
    return hostedUrl;
  }
  if (Platform.OS === 'web') {
    // Web can use relative paths
    return '';
  }

  if (!__DEV__) {
    throw new Error('Set EXPO_PUBLIC_GROQ_API_URL to your EAS Hosting base URL before building the APK.');
  }

  // Native platforms (iOS / Android)
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      // hostUri looks like "192.168.1.100:8081"
      return `http://${hostUri}`;
    }
  } catch {
    // Fall through to default
  }

  // Local dev fallback for simulator (iOS simulator can use localhost)
  if (Platform.OS === 'ios') {
    return 'http://localhost:8081';
  }

  // Android emulator uses 10.0.2.2 to reach host machine
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8081';
  }

  return '';
}

/**
 * Builds a full API URL for the given endpoint path.
 * Example: getApiUrl('/api/groq') => 'http://192.168.1.100:8081/api/groq'
 */
export function getApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

