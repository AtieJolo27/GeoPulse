import { getFertilizerImage } from '@/app/lib/cropImages';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import * as Progress from 'react-native-progress';

interface BestFertilizerProps {
    fertilizer_name: string;
    percentage: number;
    fontScale?: number;
}

const getStatus = (percentage: number) => {
    if (percentage >= 80) {
        return { color: '#259406', bg: '#EAF7E9', icon: 'checkmark-circle' as const, label: 'Great match' };
    } else if (percentage > 45) {
        return { color: '#B8A400', bg: '#FCF9E3', icon: 'alert-circle' as const, label: 'Fair match' };
    } else {
        return { color: '#BD0909', bg: '#FBEAEA', icon: 'close-circle' as const, label: 'Poor match' };
    }
};

export default function BestFertilizer({ fertilizer_name, percentage, fontScale = 1 }: BestFertilizerProps) {
    const colors = useThemeColors();
    const decimal = percentage / 100;
    const status = getStatus(percentage);
    const imageUrl = getFertilizerImage(fertilizer_name);
    const fs = (size: number) => Math.round(size * fontScale);

    return (
        <Link
            href={{ pathname: '/(tabs)/fertilizer/reasoning', params: { fertilizer: fertilizer_name } }}
            asChild
        >
            <TouchableOpacity
                activeOpacity={0.7}
                className="flex-row items-center rounded-2xl p-3 m-1"
                style={{ 
                    backgroundColor: colors.sensorCardBg, 
                    borderColor: colors.sensorCardBorder, 
                    borderWidth: 1,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                }}
            >
                <View className="mr-3">
                    <Image
                         source={imageUrl}
                         style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                    <View
                        className="absolute -bottom-1 -right-1 items-center justify-center rounded-full border-2 border-white"
                        style={{ backgroundColor: status.bg, width: 20, height: 20 }}
                    >
                        <Ionicons name={status.icon} size={12} color={status.color} />
                    </View>
                </View>

                <View className="flex-1">
                    <Text style={{ fontSize: fs(11), textTransform: 'uppercase', letterSpacing: 1, color: colors.greenText }}>
                        Best fertilizer for your field
                    </Text>

                    <View className="flex-row items-center justify-between mt-0.5">
                        <Text style={{ fontWeight: 'bold', fontSize: fs(16), textTransform: 'capitalize', color: colors.text }}>
                            {fertilizer_name}
                        </Text>
                        <Text style={{ fontWeight: 'bold', fontSize: fs(14), color: status.color }}>
                            {percentage}%
                        </Text>
                    </View>

                    <View className="mt-2">
                        <Progress.Bar
                            progress={decimal}
                            height={6}
                            color={status.color}
                            unfilledColor={colors.progressTrack}
                            borderWidth={0}
                            width={null}
                            borderRadius={3}
                        />
                    </View>
                </View>
            </TouchableOpacity>
        </Link>
    );
}
