import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { getFertilizerImage } from '@/app/lib/cropImages';
import { Link } from 'expo-router';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import * as Progress from 'react-native-progress';

interface RecommendedFertilizerProps {
    fertilizer_name: string;
    percentage: number;
    fontScale?: number;
}

const getStatus = (percentage: number) => {
    if (percentage >= 80) {
        return { color: '#259406', bg: '#EAF7E9', icon: 'checkmark-circle' as const };
    } else if (percentage > 45) {
        return { color: '#B8A400', bg: '#FCF9E3', icon: 'alert-circle' as const };
    } else {
        return { color: '#BD0909', bg: '#FBEAEA', icon: 'close-circle' as const };
    }
};

export default function RecommendedFertilizer({ fertilizer_name, percentage, fontScale = 1 }: RecommendedFertilizerProps) {
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
                className="mb-3 flex-row items-center rounded-2xl p-4"
                style={{ 
                    backgroundColor: colors.cardBg, 
                    borderColor: colors.cardBorder, 
                    borderWidth: 1,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.06,
                    shadowRadius: 3,
                    elevation: 2,
                }}
            >
                <View className="mr-3">
                    <Image
                        source={imageUrl}
                        className="w-11 h-11 rounded-full"
                        style={{ width: 44, height: 44, borderRadius: 22 }}
                    />
                    <View
                        className="absolute -bottom-1 -right-1 items-center justify-center rounded-full border-2 border-white"
                        style={{ backgroundColor: status.bg, width: 18, height: 18 }}
                    >
                        <Ionicons name={status.icon} size={10} color={status.color} />
                    </View>
                </View>

                <View className="flex-1">
                    <View className="flex-row items-start">
                        <Text className="flex-1 mr-2" numberOfLines={2} style={{ fontWeight: 'bold', fontSize: fs(16), lineHeight: fs(20), textTransform: 'capitalize', color: colors.text }}>
                            {fertilizer_name}
                        </Text>
                        <View className="rounded-full px-2 py-1" style={{ backgroundColor: status.bg }}><Text style={{ fontWeight: '800', fontSize: fs(13), color: status.color }}>{percentage}%</Text></View>
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
