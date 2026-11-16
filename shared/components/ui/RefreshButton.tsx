import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/shared/appLib/AppContext';
import { useThemeColors } from '@/shared/appLib/useThemeColors';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

export function RefreshButton({ onPress, loading = false, disabled = false, retry = false, accessibilityLabel }: {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  retry?: boolean;
  accessibilityLabel?: string;
}) {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const blocked = disabled || loading;
  const label = loading ? t('Refreshing...', 'Nire-refresh...') : retry ? t('Retry', 'Subukan muli') : t('Refresh', 'I-refresh');
  return <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled: blocked, busy: loading }}
    disabled={blocked}
    activeOpacity={0.7}
    onPress={onPress}
    style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBg, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: blocked ? 0.6 : 1 }}
  >
    {loading ? <ActivityIndicator size="small" color={colors.greenText} /> : <Ionicons name="refresh-outline" size={18} color={colors.greenText} />}
    <Text style={{ color: colors.greenText, fontWeight: '700', fontSize: 13 * fontScale }}>{label}</Text>
  </TouchableOpacity>;
}
