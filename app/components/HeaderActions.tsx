import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotificationButton } from './NotificationButton';
import SensorWifiScreen from './SensorWifiScreen';
import { WeatherIndicator } from './WeatherIndicator';

export function HeaderActions() {
  const [wifiModalVisible, setWifiModalVisible] = useState(false);

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 2 }}>
        <WeatherIndicator />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Sensor Wi-Fi"
          onPress={() => setWifiModalVisible(true)}
          hitSlop={8}
          activeOpacity={0.7}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="wifi" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <NotificationButton />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/profile')} hitSlop={8} activeOpacity={0.7} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person-circle-outline" size={25} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={wifiModalVisible}
        animationType="slide"
        onRequestClose={() => setWifiModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingTop: 50,
              paddingBottom: 12,
              backgroundColor: '#1B5E37',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: 'white' }}>Sensor Wi-Fi</Text>
            <TouchableOpacity
              onPress={() => setWifiModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close-circle" size={28} color="white" />
            </TouchableOpacity>
          </View>

          <SensorWifiScreen />
        </View>
      </Modal>
    </>
  );
}
