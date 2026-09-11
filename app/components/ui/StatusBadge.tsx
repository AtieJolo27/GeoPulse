import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

export type StatusTone = 'healthy' | 'warning' | 'critical' | 'neutral';

const tones: Record<StatusTone, { background: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  healthy: { background: '#DCFCE7', color: '#166534', icon: 'checkmark-circle' },
  warning: { background: '#FEF3C7', color: '#92400E', icon: 'warning' },
  critical: { background: '#FEE2E2', color: '#B91C1C', icon: 'alert-circle' },
  neutral: { background: '#E5E7EB', color: '#4B5563', icon: 'information-circle' },
};

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const style = tones[tone];
  return (
    <View
      accessibilityLabel={label}
      className="flex-row items-center self-start rounded-full px-2.5 py-1.5"
      style={{ backgroundColor: style.background }}
    >
      <Ionicons name={style.icon} size={14} color={style.color} />
      <Text className="ml-1 text-xs font-extrabold" style={{ color: style.color }}>{label}</Text>
    </View>
  );
}
