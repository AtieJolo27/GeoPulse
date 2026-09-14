import { useThemeColors } from '@/app/lib/useThemeColors';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface LoadingSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function LoadingSkeleton({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: LoadingSkeletonProps) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.isDarkMode ? '#1A3522' : '#E9EEEA',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SensorSkeleton() {
  const colors = useThemeColors();
  return (
    <View
      className="border rounded-2xl p-3 flex-1"
      style={{ backgroundColor: colors.sensorCardBg, borderColor: colors.sensorCardBorder }}
    >
      <View className="items-center gap-2">
        <LoadingSkeleton width={24} height={24} borderRadius={12} />
        <LoadingSkeleton width={60} height={14} />
        <LoadingSkeleton width={50} height={24} />
        <LoadingSkeleton width={75} height={8} borderRadius={4} />
      </View>
    </View>
  );
}

export function DashboardSkeleton() {
  const colors = useThemeColors();
  return (
    <View className="px-7 py-5" style={{ backgroundColor: colors.bg, flex: 1 }}>
      {/* Zone buttons skeleton */}
      <LoadingSkeleton width={120} height={18} style={{ marginBottom: 12 }} />
      <View className="flex-row gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <LoadingSkeleton key={i} width="30%" height={52} borderRadius={16} />
        ))}
      </View>

      {/* Soil health score skeleton */}
      <LoadingSkeleton width={160} height={18} style={{ marginBottom: 8 }} />
      <View
        className="border rounded-2xl p-4 mb-4"
        style={{ borderColor: colors.border, backgroundColor: colors.cardBg }}
      >
        <LoadingSkeleton width={24} height={24} borderRadius={12} style={{ marginBottom: 12 }} />
        <View className="flex-row gap-3">
          <LoadingSkeleton width={71} height={71} borderRadius={35.5} />
          <View className="flex-1 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <LoadingSkeleton key={i} width="100%" height={16} />
            ))}
          </View>
        </View>
      </View>

      {/* Sensors skeleton */}
      <LoadingSkeleton width={140} height={18} style={{ marginBottom: 8 }} />
      <View className="flex-row gap-2 mb-2">
        {[1, 2, 3].map((i) => (
          <SensorSkeleton key={i} />
        ))}
      </View>
      <View className="flex-row gap-2 mb-4">
        {[1, 2, 3].map((i) => (
          <SensorSkeleton key={i} />
        ))}
      </View>

      {/* Urgent notifications skeleton */}
      <LoadingSkeleton width={180} height={18} style={{ marginBottom: 8 }} />
      <LoadingSkeleton width="100%" height={80} borderRadius={12} />
    </View>
  );
}

