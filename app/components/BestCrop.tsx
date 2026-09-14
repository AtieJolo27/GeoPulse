import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { getCropImage } from '@/app/lib/cropImages';
import { Link } from 'expo-router';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import * as Progress from 'react-native-progress';

interface BestCropProps {
    crop_name: string;
    percentage: number;
    fontScale?: number;
}

const getStatus = (percentage: number) => {
    if (percentage >= 80) {
        return { color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle' as const, label: 'Great match' };
    } else if (percentage > 45) {
        return { color: '#EAB308', bg: '#FEF9C3', icon: 'alert-circle' as const, label: 'Fair match' };
    } else {
        return { color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle' as const, label: 'Poor match' };
    }
};

export default function BestCrop({ crop_name, percentage, fontScale = 1 }: BestCropProps) {
    const colors = useThemeColors();
    const fs = (size: number) => Math.round(size * fontScale);
    const decimal = percentage / 100;
    const status = getStatus(percentage);
    const imageUrl = getCropImage(crop_name);

    return (
        <Link
            href={{ pathname: '/(tabs)/crop/reasoning', params: { crop: crop_name } }}
            asChild
        >
            <TouchableOpacity
                activeOpacity={0.7}
                className="rounded-3xl p-5"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderWidth: 1, shadowColor: '#183322', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }}
            >
                <View className="flex-row items-center">
                <View className="mr-4">
                    <Image
                        source={imageUrl}
                        className="w-12 h-12 rounded-full"
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
                    <Text style={{ fontSize: fs(12), color: colors.greenText, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' }}>
                        Recommended for your soil
                    </Text>

                    <Text numberOfLines={2} style={{ fontWeight: '800', fontSize: fs(22), lineHeight: fs(27), color: colors.text, textTransform: 'capitalize' }}>
                            {crop_name}
                    </Text>
                    <View className="mt-2 flex-row items-center justify-between">
                        <Text style={{ fontSize: fs(12), color: colors.subText }}>Match score</Text>
                        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: status.bg }}><Text style={{ fontWeight: '800', fontSize: fs(14), color: status.color }}>{percentage}%</Text></View>
                    </View>

                    <View className="mt-2">
                        <Progress.Bar
                            progress={decimal}
                            height={6}
                            color={status.color}
                            unfilledColor={colors.progressTrack}
                            borderWidth={0}
                            width={null}
                        />
                    </View>
                </View></View>
                <Text className="mt-4" style={{ fontSize: fs(13), lineHeight: 19, color: colors.subText }}>
                    Your current soil conditions are suitable for {crop_name}.
                </Text>
                <View className="mt-4 flex-row items-center self-start rounded-xl px-3 py-2" style={{ backgroundColor: colors.cardBgAlt }}>
                    <Ionicons name="bulb-outline" size={16} color={colors.primaryDark} />
                    <Text className="ml-2 font-bold" style={{ fontSize: fs(13), color: colors.primaryDark }}>Why is this recommended?</Text>
                </View>
            </TouchableOpacity>
        </Link>
    );
}
