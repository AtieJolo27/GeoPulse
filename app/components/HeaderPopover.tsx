import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function HeaderPopover({ visible, onClose, title, subtitle, icon, children, footer }: { visible: boolean; onClose: () => void; title: string; subtitle?: string; icon: keyof typeof Ionicons.glyphMap; children: ReactNode; footer?: ReactNode }) {
  const colors = useThemeColors();
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const top = insets.top + 56;
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <View style={{ flex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Close panel', 'Isara ang panel')} onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} />
      <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, alignItems: 'flex-end', paddingTop: top, paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}>
        <View accessibilityViewIsModal style={{ width: Math.min(width - 32, 420), maxHeight: Math.max(100, Math.min(520, height * 0.68, height - top - insets.bottom - 16)), flexShrink: 1, borderRadius: 24, padding: 18, backgroundColor: colors.cardBg, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Ionicons name={icon} size={24} color={colors.primaryLight} />
            <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>{!!subtitle && <Text style={{ color: colors.subText, fontSize: 12, marginTop: 3 }}>{subtitle}</Text>}</View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('Close', 'Isara')} onPress={onClose} style={{ padding: 8 }}><Ionicons name="close" size={23} color={colors.subText} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 4 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator nestedScrollEnabled>{children}</ScrollView>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}
