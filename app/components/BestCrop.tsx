import { getCropImage } from '@/app/lib/cropImages';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
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
                className="flex-row items-center rounded-2xl p-3 m-1"
                style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderWidth: 1, shadowColor: '#0D5E33', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
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
                    <Text style={{ fontSize: fs(11), color: colors.greenText, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Best crop for your field
                    </Text>

                    <View className="flex-row items-center justify-between mt-0.5">
                        <Text style={{ fontWeight: 'bold', fontSize: fs(16), color: colors.text, textTransform: 'capitalize' }}>
                            {crop_name}
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
                        />
                    </View>
                </View>
            </TouchableOpacity>
        </Link>
    );
}
