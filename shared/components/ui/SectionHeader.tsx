import { useApp } from '@/shared/appLib/AppContext';
import React from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/shared/appLib/useThemeColors';

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const colors = useThemeColors();
  const { fontScale } = useApp();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
      <View style={{ flexGrow: 1, flexShrink: 1 }}>
        <Text accessibilityRole="header" style={{ fontSize: 18 * fontScale, fontWeight: '800', color: colors.text, letterSpacing: -0.4 }}>{title}</Text>
        {subtitle ? <Text className="mt-1" style={{ color: colors.subText, fontSize: 13 * fontScale, lineHeight: 20 * fontScale }}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
