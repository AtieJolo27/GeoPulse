import React from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/app/lib/useThemeColors';

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View className="mb-3 flex-row items-end justify-between">
      <View className="flex-1">
        <Text className="text-lg font-extrabold" style={{ color: colors.text }}>{title}</Text>
        {subtitle ? <Text className="mt-1 text-xs leading-4" style={{ color: colors.subText }}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
