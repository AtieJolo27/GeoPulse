import { router } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotificationButton } from './NotificationButton';
import { WeatherIndicator } from './WeatherIndicator';

export function HeaderActions() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 2 }}>
      <WeatherIndicator />
      <NotificationButton />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/profile')} hitSlop={8} activeOpacity={0.7} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person-circle-outline" size={25} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
