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
 * In production, replace with your deployed API endpoint.
 */
export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') {
    // Web can use relative paths
    return '';
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

  // Fallback for production or if hostUri is unavailable
  // Update this to your production API endpoint when deploying
  const productionUrl = process.env.EXPO_PUBLIC_API_URL;
  if (productionUrl) {
    return productionUrl;
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

