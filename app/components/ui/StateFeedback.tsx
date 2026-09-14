import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/app/lib/useThemeColors';

export function StateFeedback({ icon, title, message, action }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; title: string; message: string; action?: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View className="flex-1 items-center justify-center px-7" style={{ backgroundColor: colors.bg }}>
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl" style={{ backgroundColor: colors.cardBgAlt }}>
        <Ionicons name={icon} size={32} color={colors.primaryDark} />
      </View>
      <Text className="text-center text-lg font-bold" style={{ color: colors.text }}>{title}</Text>
      <Text className="mt-2 text-center text-sm leading-5" style={{ color: colors.subText }}>{message}</Text>
      {action ? <View className="mt-5 w-full">{action}</View> : null}
    </View>
  );
}
