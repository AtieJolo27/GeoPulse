import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import { Text, View } from 'react-native';
import type { ComponentProps } from 'react';

export function ScreenIntro({ icon, eyebrow, title, description }: {
  icon: ComponentProps<typeof Ionicons>['name'];
  eyebrow: string; title: string; description?: string;
}) {
  const colors = useThemeColors();
  const { fontScale } = useApp();
  return <View style={{ marginBottom: 24 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardBgAlt }}>
        <Ionicons name={icon} size={18} color={colors.greenText} />
      </View>
      <Text style={{ fontSize: 11 * fontScale, letterSpacing: 1.2, fontWeight: '800', color: colors.greenText }}>{eyebrow}</Text>
    </View>
    <Text accessibilityRole="header" style={{ fontSize: 28 * fontScale, lineHeight: 35 * fontScale, letterSpacing: -0.8, fontWeight: '800', color: colors.text }}>{title}</Text>
    {description && <Text style={{ marginTop: 8, fontSize: 14 * fontScale, lineHeight: 21 * fontScale, color: colors.subText }}>{description}</Text>}
  </View>;
}
