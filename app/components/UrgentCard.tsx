import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Link } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { lightHaptic } from '../../lib/haptics';

interface UrgentCardProps {
  field: string;
  message: string;
  date: string;
  severity?: 'high' | 'medium' | 'low';
}

const SEVERITY_COLORS = {
  high: { border: '#DC2626', bg: '#FEE2E2', icon: 'alert-circle' as const, text: '#DC2626' },
  medium: { border: '#EAB308', bg: '#FEF9C3', icon: 'warning-outline' as const, text: '#CA8A04' },
  low: { border: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle-outline' as const, text: '#16A34A' },
};

export default function UrgentCard({ field, message, date, severity = 'high' }: UrgentCardProps) {
  const colors = useThemeColors();
  const sevColors = SEVERITY_COLORS[severity];
  const darkBorder = severity === 'high' ? '#DC2626' : severity === 'medium' ? '#EAB308' : '#16A34A';
  const lightBorder = severity === 'high' ? '#FCA5A5' : severity === 'medium' ? '#FDE68A' : '#BBF7D0';

  return (
    <Link href="/(tabs)/crop/reasoning" asChild>
      <TouchableOpacity
        onPress={() => lightHaptic()}
        className="flex-1 flex-row border border-solid rounded-lg m-1"
        style={{
          borderColor: colors.isDarkMode ? darkBorder : lightBorder,
          backgroundColor: colors.isDarkMode ? '#1F2937' : '#FFFFFF',
        }}
        accessibilityRole="button"
        accessibilityLabel={`${severity} alert: ${field}. ${message}`}
      >
        <View className="p-2 justify-center">
          <Ionicons name={sevColors.icon} size={24} color={sevColors.text} />
        </View>
        <View className="flex-1 py-2 pr-2">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold text-base" style={{ color: colors.text }}>
              {field}
            </Text>
            {severity === 'high' && (
              <View className="bg-red-100 rounded-full px-1.5 py-0.5">
                <Text className="text-red-600 text-xs font-bold">URGENT</Text>
              </View>
            )}
          </View>
          <Text className="font-light text-xs" style={{ color: colors.subText }}>
            {date}
          </Text>
          <Text className="text-sm mt-1" style={{ color: colors.text }}>
            {message}
          </Text>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({});
