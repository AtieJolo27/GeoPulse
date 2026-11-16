import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import { PrimaryButton } from '@/shared/components/ui/PrimaryButton';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

export default function SensorWifiScreen() {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const [error, setError] = useState(false);
  const steps = [
    t('Open your phones Wi-Fi settings and connect to Geopulse-setup. Stay connected even if your phone says ?No internet?.', 'Buksan ang Wi-Fi settings ng telepono at kumonekta sa Geopulse-setup. Manatiling konektado kahit may ?No internet?.'),
    t('The setup page may open automatically. If it does not, open http://192.168.4.1 in your browser, or tap the button below.', 'Maaaring awtomatikong bumukas ang setup page. Kung hindi, buksan ang http://192.168.4.1 sa browser o pindutin ang button sa ibaba.'),
    t('On the setup page, find and select the Wi-Fi network the sensor should use. Enter that network?s password and save/connect.', 'Sa setup page, hanapin at piliin ang Wi-Fi na gagamitin ng sensor. Ilagay ang password ng Wi-Fi at piliin ang save/connect.'),
    t('Reconnect your phone to your usual Wi-Fi or mobile data, then return to GeoPulse. The status turns green when fresh sensor readings arrive.', 'Ikonekta muli ang telepono sa karaniwang Wi-Fi o mobile data, saka bumalik sa GeoPulse. Magiging berde ang status kapag may bagong datos ng sensor.'),
  ];
  return <View style={{ gap: 16 }}>
    <Text style={{ color: colors.subText, fontSize: 13 * fontScale, lineHeight: 20 * fontScale }}>{t('If Geopulse-setup is not listed, make sure the sensor is powered on and in its Wi-Fi setup mode.', 'Kung wala ang Geopulse-setup, tiyaking nakabukas ang sensor at nasa Wi-Fi setup mode ito.')}</Text>
    {steps.map((step, index) => <View key={index} style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: colors.cardBgAlt, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.greenText, fontWeight: '800' }}>{index + 1}</Text></View>
      <Text style={{ flex: 1, color: colors.text, fontSize: 14 * fontScale, lineHeight: 21 * fontScale }}>{step}</Text>
    </View>)}
    <PrimaryButton label={t('Open sensor setup', 'Buksan ang sensor setup')} icon="open-outline" onPress={() => {
      setError(false);
      void Linking.openURL('http://192.168.4.1').catch(() => setError(true));
    }} />
    {error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t('Open your browser and enter http://192.168.4.1 while connected to Geopulse-setup.', 'Buksan ang browser at ilagay ang http://192.168.4.1 habang konektado sa Geopulse-setup.')}</Text>}
  </View>;
}
