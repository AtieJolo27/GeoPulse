import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Text, View } from 'react-native';

export default function SensorManual() {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const steps = [
    t('1. Clean the probe and check its calibration. Insert it to the depth specified by its manufacturer, with firm soil contact and no air gaps. Keep it still.', '1. Linisin at suriin ang calibration ng probe. Ipasok sa lalim na itinakda ng gumawa, na nakadikit nang maayos sa lupa at walang puwang. Huwag galawin.'),
    t('2. How long should I wait? Follow your sensor’s specified warm-up and settling time after powering on or moving it. GeoPulse has no verified timing specification for your sensor, so a fixed number of seconds or minutes cannot guarantee a stable reading.', '2. Gaano katagal maghihintay? Sundin ang warm-up at settling time ng gumawa matapos buksan o ilipat ang sensor. Walang beripikadong oras para sa iyong sensor sa GeoPulse, kaya walang tiyak na segundo o minuto na makagagarantiya ng matatag na datos.'),
    t('3. After that waiting period, compare at least three consecutive updates with the probe undisturbed. Use readings only when changes stay within the manufacturer’s repeatability tolerance. This is a manual check; GeoPulse does not automatically certify stability. An unchanged timestamp may mean stale data.', '3. Pagkatapos maghintay, ihambing ang hindi bababa sa tatlong sunod na update nang hindi ginagalaw ang probe. Gamitin lamang kapag pasok ang pagbabago sa repeatability tolerance ng gumawa. Manwal itong pagsusuri; hindi awtomatikong nagpapatunay ng stability ang GeoPulse. Maaaring lumang datos ang hindi nagbabagong oras.'),
    t('4. If values keep drifting, wait longer and check soil contact, power, connection and calibration. Repeat the settling check after moving the probe, watering or adding fertilizer. Record the zone and time; stable readings can still be inaccurate if calibration is wrong.', '4. Kung patuloy na nagbabago ang datos, maghintay pa at suriin ang pagkakadikit, kuryente, koneksyon at calibration. Ulitin matapos ilipat, diligan o lagyan ng pataba. Itala ang sona at oras; maaari pa ring mali ang matatag na datos kapag mali ang calibration.'),
  ];
  return <View style={{ padding: 16, marginBottom: 16, borderRadius: 16, backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderWidth: 1 }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: '800', fontSize: 18 * fontScale }}>{t('Sensor user manual', 'Manwal ng sensor')}</Text>
    {steps.map(step => <Text key={step} style={{ marginTop: 12, color: colors.subText, fontSize: 13 * fontScale, lineHeight: 20 * fontScale }}>{step}</Text>)}
  </View>;
}
