import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderActions } from '@/shared/components/HeaderActions';

export function TabScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const colors = useThemeColors();
  const { t, fontScale } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: colors.headerBg, paddingTop: insets.top }}>
      <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingLeft: Math.max(insets.left, 20), paddingRight: Math.max(insets.right, 8) }}>
        {onBack && (
          <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel={t('Go back', 'Bumalik')} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={22} color={colors.headerText} />
          </TouchableOpacity>
        )}
        <Text numberOfLines={1} style={{ flex: 1, marginRight: 8, fontSize: 20 * fontScale, fontWeight: '800', letterSpacing: -0.5, color: colors.headerText }}>{title}</Text>
        <HeaderActions />
      </View>
    </View>
  );
}
