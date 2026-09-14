import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useThemeColors } from '@/app/lib/useThemeColors';

export function PrimaryButton({ label, onPress, icon, disabled = false }: {
  label: string; onPress: () => void; icon?: React.ComponentProps<typeof Ionicons>['name']; disabled?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.82}
      disabled={disabled}
      onPress={onPress}
      className="min-h-12 flex-row items-center justify-center rounded-2xl px-4 py-3"
      style={{ backgroundColor: disabled ? colors.mutedText : colors.primary, opacity: disabled ? 0.6 : 1 }}
    >
      {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
      <Text className={icon ? 'ml-2 font-bold text-white' : 'font-bold text-white'}>{label}</Text>
    </TouchableOpacity>
  );
}
