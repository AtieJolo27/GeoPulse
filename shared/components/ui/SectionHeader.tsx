import React from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/shared/appLib/useThemeColors';

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View className="mb-3 flex-row items-end justify-between">
      <View className="flex-1">
        <Text accessibilityRole="header" className="text-lg font-extrabold" style={{ color: colors.text, letterSpacing: -0.4 }}>{title}</Text>
        {subtitle ? <Text className="mt-1" style={{ color: colors.subText, fontSize: 13, lineHeight: 20 }}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
