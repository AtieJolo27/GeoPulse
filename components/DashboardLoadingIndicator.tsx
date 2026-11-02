import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';

export default function DashboardLoadingIndicator({ readings = false }: { readings?: boolean }) {
  const { t } = useApp();
  const colors = useThemeColors();
  const [takingLonger, setTakingLonger] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTakingLonger(true), 12000);
    return () => clearTimeout(timer);
  }, []);
  return <View accessibilityRole="progressbar" accessibilityLabel={t('Fetching dashboard data', 'Kinukuha ang datos ng dashboard')}
    accessibilityState={{ busy: true }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginBottom: 16, borderRadius: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border }}>
    <ActivityIndicator size="small" color={colors.primary} />
    <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
      <Text style={{ color: colors.text, fontWeight: '700' }}>{readings ? t('Fetching soil readings…', 'Kinukuha ang datos ng lupa…') : t('Connecting to your farm…', 'Kumokonekta sa iyong bukid…')}</Text>
      <Text style={{ color: colors.subText, marginTop: 4 }}>{takingLonger
        ? t('Still connecting. The server may be waking up; this can take a minute or more. You can stay on this screen.', 'Kumokonekta pa rin. Maaaring nagsisimula pa ang server; puwedeng umabot ng isang minuto o higit pa. Manatili lang sa screen na ito.')
        : t('Your data will appear automatically when ready.', 'Kusang lalabas ang datos kapag handa na.')}</Text>
    </View>
  </View>;
}
