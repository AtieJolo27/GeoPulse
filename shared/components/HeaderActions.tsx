import { TutorialTarget, useTutorial } from '@/shared/appLib/TutorialContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import { useSensorConnection } from '@/shared/appLib/SensorConnectionContext';
import { useApp } from '@/shared/appLib/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { DrawerToggleButton } from 'expo-router/drawer';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { HeaderPopover } from '@/shared/components/HeaderPopover';
import { NotificationButton } from '@/shared/components/NotificationButton';
import SensorWifiScreen from '@/shared/components/SensorWifiScreen';
import { WeatherIndicator } from '@/shared/components/WeatherIndicator';

export function HeaderActions() {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const { openCurrent } = useTutorial();
  const { status, timestamp } = useSensorConnection();
  const online = status === 'online';
  const statusLabel = online ? t('Sensor online', 'Online ang sensor') : status === 'offline' ? t('Sensor offline', 'Offline ang sensor') : status === 'checking' ? t('Checking sensor', 'Sinusuri ang sensor') : t('Sensor status unavailable', 'Hindi makuha ang status ng sensor');
  const statusColor = online ? '#86EFAC' : status === 'offline' ? '#FCA5A5' : '#FDE68A';
  const [wifiModalVisible, setWifiModalVisible] = useState(false);
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 2 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Tutorial for this tab', 'Tutorial para sa tab na ito')} onPress={openCurrent} style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="help-circle-outline" size={22} color={colors.headerText} /></TouchableOpacity>
      <WeatherIndicator />
      <TutorialTarget id="sensor"><TouchableOpacity accessibilityRole={online ? 'image' : 'button'} accessibilityLabel={online ? `${statusLabel}. ${t('Receiving recent readings.', 'May bagong datos.')}` : `${statusLabel}. ${t('Open Wi-Fi setup guide', 'Buksan ang gabay sa Wi-Fi setup')}`} disabled={online} onPress={() => setWifiModalVisible(true)} activeOpacity={0.7} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={online ? 'cloud-done-outline' : status === 'offline' ? 'cloud-offline-outline' : 'cloud-outline'} size={23} color={statusColor} />
        <View style={{ position: 'absolute', right: 6, bottom: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
      </TouchableOpacity></TutorialTarget>
      <NotificationButton />
      <TutorialTarget id="sidebar"><DrawerToggleButton tintColor="#FFFFFF" /></TutorialTarget>
    </View>
    <HeaderPopover visible={wifiModalVisible} onClose={() => setWifiModalVisible(false)} title={online ? statusLabel : t('Connect your sensor', 'Ikonekta ang sensor')} subtitle={statusLabel} icon={online ? 'cloud-done-outline' : 'cloud-offline-outline'}>
      {online ? <Text style={{ color: colors.greenText }}>{t('Fresh readings are arriving. Your sensor is online.', 'May bagong datos. Online ang iyong sensor.')}</Text> : <SensorWifiScreen />}
      <Text style={{ marginTop: 16, color: colors.subText, fontSize: 12 * fontScale }}>{t('Status uses readings from the last 60 seconds.', 'Batay ang status sa datos sa nakalipas na 60 segundo.')}{timestamp ? ` ${t('Last reading', 'Huling datos')}: ${new Date(timestamp).toLocaleString()}` : ''}</Text>
    </HeaderPopover>
  </>;
}
