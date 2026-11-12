import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import CropGuides from '../components/CropGuides';

export default function TipsScreen() {
  const insets = useSafeAreaInsets();
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const fs = (size: number) => Math.round(size * fontScale);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg, paddingBottom: insets.bottom }}>
      {/* Header */}
      <View
        className="flex-row items-center px-3 pt-12 pb-5"
        style={{
          backgroundColor: colors.headerBg,
          paddingTop: insets.top + 12,
          shadowColor: '#0D5E33',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {router.canGoBack() ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}

        <Text
          className="flex-1 text-center mb-0"
          style={{ fontSize: fs(18), fontWeight: 'bold', color: 'white' }}
        >
          {t('Tips and Guides', 'Mga Tip at Gabay')}
        </Text>

        {/* Balances the back button so the title stays centered */}
        <View style={{ width: 24 }} />
      </View>

      <CropGuides />
    </View>
  );
}