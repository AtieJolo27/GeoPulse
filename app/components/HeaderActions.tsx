import { useApp } from '@/app/lib/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { DrawerToggleButton } from 'expo-router/drawer';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { HeaderPopover } from './HeaderPopover';
import { NotificationButton } from './NotificationButton';
import SensorWifiScreen from './SensorWifiScreen';
import { WeatherIndicator } from './WeatherIndicator';

export function HeaderActions() {
  const { t } = useApp();
  const [wifiModalVisible, setWifiModalVisible] = useState(false);
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 2 }}>
      <WeatherIndicator />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Sensor Wi-Fi', 'Wi-Fi ng sensor')} onPress={() => setWifiModalVisible(true)} hitSlop={8} activeOpacity={0.7} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="wifi" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <NotificationButton />
      <DrawerToggleButton tintColor="#FFFFFF" />
    </View>
    <HeaderPopover visible={wifiModalVisible} onClose={() => setWifiModalVisible(false)} title={t('Sensor Wi-Fi', 'Wi-Fi ng sensor')} icon="wifi-outline">
      <SensorWifiScreen />
    </HeaderPopover>
  </>;
}
