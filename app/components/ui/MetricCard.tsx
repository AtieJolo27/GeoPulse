import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { StatusBadge, StatusTone } from './StatusBadge';

export function MetricCard({ icon, label, value, status, tone = 'neutral' }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; status: string; tone?: StatusTone;
}) {
  const colors = useThemeColors();
  return (
    <View className="min-h-36 flex-1 rounded-2xl border p-4" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder, shadowColor: '#183322', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 }}>
      <View className="mb-3 h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: colors.cardBgAlt }}>
        <Ionicons name={icon} size={17} color={colors.primaryDark} />
      </View>
      <Text className="text-xs font-semibold" style={{ color: colors.subText }}>{label}</Text>
      <Text className="mt-1 text-xl font-extrabold" style={{ color: colors.text }}>{value}</Text>
      <View className="mt-2"><StatusBadge label={status} tone={tone} /></View>
    </View>
  );
}
