import type { FontSize } from '@/app/lib/AppContext';
import { useApp } from '@/app/lib/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import "../global.css";

const LANGUAGE_OPTIONS = [
  { key: 'tagalog' as const, label: 'Tagalog', icon: 'chatbubbles-outline' as const },
  { key: 'english' as const, label: 'English', icon: 'language-outline' as const },
];

export default function settings() {
  const [fontSizeModalVisible, setFontSizeModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const { isDarkMode, toggleTheme, language, setLanguage, t, user, login, logout, loading, fontSize, setFontSize, fontScale } = useApp();
  const bgColor = isDarkMode ? '#111827' : '#FFFFFF';
  const cardBg = isDarkMode ? '#1F2937' : '#FFFFFF';
  const textColor = isDarkMode ? '#9CA3AF' : '#1F2937';
  const subTextColor = isDarkMode ? '#6B7280' : '#6B7280';
  const borderColor = isDarkMode ? '#374151' : '#E5E7EB';
  const headerBg = isDarkMode ? '#0F3D37' : '#184B44';
  const fs = (size: number) => size * fontScale;

  const handleLanguageSelect = (lang: 'tagalog' | 'english') => {
    setLanguage(lang);
    setLanguageModalVisible(false);
    Alert.alert(
      t('Language Changed', 'Binago ang Wika'),
      lang === 'tagalog'
        ? 'Ang wika ay nakatakda sa Tagalog.'
        : 'Language has been set to English.'
    );
  };

  return (
    <View>
      <View
        className="flex-row justify-center px-3 pt-12 pb-5"
        style={{
          backgroundColor: '#1B5E37',
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
          className="flex-1  text-center mb-0"
          style={{ fontSize: fs(18), fontWeight: 'bold', color: 'white' }}
        >
          {t('Settings', 'Mga Settings')}
        </Text>

        {/* Balances the back button so the title stays centered */}
        <View style={{ width: 24 }} />
      </View>
      <View
        className="rounded-2xl p-4 mb-4 shadow-sm"
        style={{ backgroundColor: cardBg, borderColor: borderColor, borderWidth: 1 }}
      >
        <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: fs(12), letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
          {t('Settings', 'Settings')}
        </Text>

        {/* Dark Mode Toggle */}
        <TouchableOpacity
          onPress={toggleTheme}
          className="flex-row items-center py-3"
          style={{ borderBottomWidth: 1, borderBottomColor: borderColor }}
        >
          <View className="w-8 h-8 bg-green-50 rounded-full items-center justify-center mr-3">
            <Ionicons
              name={isDarkMode ? 'moon' : 'moon-outline'}
              size={16}
              color="#184B44"
            />
          </View>
          <View className="flex-1">
            <Text style={{ color: textColor, fontWeight: '500', fontSize: fs(14) }}>
              {t('Dark Mode', 'Dark Mode')}
            </Text>
          </View>
          <View
            className={`w-10 h-5 rounded-full items-center justify-center`}
            style={{
              backgroundColor: isDarkMode ? '#16A34A' : '#D1D5DB',
            }}
          >
            <View
              className="w-4 h-4 rounded-full bg-white shadow-sm"
              style={{
                alignSelf: isDarkMode ? 'flex-end' : 'flex-start',
                marginHorizontal: 2,
              }}
            />
          </View>
        </TouchableOpacity>

        {/* Language Selector */}
        <TouchableOpacity
          onPress={() => setLanguageModalVisible(true)}
          className="flex-row items-center py-3"
          style={{ borderBottomWidth: 1, borderBottomColor: borderColor }}
        >
          <View className="w-8 h-8 bg-green-50 rounded-full items-center justify-center mr-3">
            <Ionicons name="language-outline" size={16} color="#184B44" />
          </View>
          <View className="flex-1">
            <Text style={{ color: textColor, fontWeight: '500', fontSize: fs(14) }}>
              {t('Language', 'Wika')}
            </Text>
            <Text style={{ color: subTextColor, fontSize: fs(12), marginTop: 2 }}>
              {language === 'tagalog' ? 'Tagalog' : 'English'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </TouchableOpacity>

        {/* Font Size Selector */}
        <TouchableOpacity
          onPress={() => setFontSizeModalVisible(true)}
          className="flex-row items-center py-3"
        >
          <View className="w-8 h-8 bg-green-50 rounded-full items-center justify-center mr-3">
            <Ionicons name="text-outline" size={16} color="#184B44" />
          </View>
          <View className="flex-1">
            <Text style={{ color: textColor, fontWeight: '500', fontSize: fs(14) }}>
              {t('Font Size', 'Laki ng Teksto')}
            </Text>
            <Text style={{ color: subTextColor, fontSize: fs(12), marginTop: 2 }}>
              {fontSize === 'small' ? t('Small', 'Maliit') : fontSize === 'large' ? t('Large', 'Malaki') : t('Medium', 'Katamtaman')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </TouchableOpacity>

        {/* Font Size Selection Modal */}
        <Modal visible={fontSizeModalVisible} transparent animationType="fade">
          <View className="flex-1 bg-black/50 justify-center items-center px-6">
            <View className="bg-white rounded-2xl w-full p-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-gray-800">
                  {t('Select Font Size', 'Pumili ng Laki ng Teksto')}
                </Text>
                <TouchableOpacity onPress={() => setFontSizeModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Font size preview */}
              <View className="mb-6 p-4 bg-green-50 rounded-xl">
                <Text className="text-center text-gray-600 font-medium">
                  {t('Preview', 'Pag-preview')}
                </Text>
                <Text
                  className="text-center mt-2"
                  style={{
                    fontSize: fontSize === 'small' ? 12 : fontSize === 'large' ? 22 : 16,
                    color: '#0D5E33',
                    fontWeight: '500',
                  }}
                >
                  {t('The quick brown fox', 'Ang mabilis na brown fox')}
                </Text>
              </View>

              {[
                { key: 'small' as FontSize, labelEn: 'Small', labelTl: 'Maliit', icon: 'remove-outline' as const, fontSize: 12 },
                { key: 'medium' as FontSize, labelEn: 'Medium', labelTl: 'Katamtaman', icon: 'text-outline' as const, fontSize: 16 },
                { key: 'large' as FontSize, labelEn: 'Large', labelTl: 'Malaki', icon: 'add-outline' as const, fontSize: 22 },
              ].map((option, index) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    const label = language === 'tagalog' ? option.labelTl : option.labelEn;
                    Alert.alert(
                      t('Confirm Font Size', 'Kumpirmahin ang Laki ng Teksto'),
                      t(`Are you sure you want to change the font size to ${label}?`, `Sigurado ka bang gusto mong baguhin ang laki ng teksto sa ${label}?`),
                      [
                        { text: t('Cancel', 'Kanselahin'), style: 'cancel' },
                        {
                          text: t('Confirm', 'Kumpirmahin'),
                          onPress: () => {
                            setFontSize(option.key);
                            setFontSizeModalVisible(false);
                          }
                        }
                      ]
                    );
                  }}
                  className="flex-row items-center py-4 px-2"
                  style={{
                    borderBottomWidth: index === 2 ? 0 : 1,
                    borderBottomColor: '#E5E7EB',
                  }}
                >
                  <View className="w-9 h-9 bg-green-50 rounded-full items-center justify-center mr-3">
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color="#0D5E33"
                    />
                  </View>
                  <Text
                    className="flex-1 ml-1 font-medium"
                    style={{
                      fontSize: option.fontSize,
                      color: fontSize === option.key ? '#0D5E33' : '#4B5563',
                      fontWeight: fontSize === option.key ? '700' : '500',
                    }}
                  >
                    {language === 'tagalog' ? option.labelTl : option.labelEn}
                  </Text>
                  {fontSize === option.key && (
                    <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* Language Selection Modal */}
        <Modal visible={languageModalVisible} transparent animationType="fade">
          <View className="flex-1 bg-black/50 justify-center items-center px-6">
            <View className="bg-white rounded-2xl w-full p-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-gray-800">
                  {t('Select Language', 'Pumili ng Wika')}
                </Text>
                <TouchableOpacity onPress={() => setLanguageModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {LANGUAGE_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => handleLanguageSelect(option.key)}
                  className="flex-row items-center py-4 px-2"
                  style={{
                    borderBottomWidth: index === LANGUAGE_OPTIONS.length - 1 ? 0 : 1,
                    borderBottomColor: '#E5E7EB',
                  }}
                >
                  <View className="w-9 h-9 bg-green-50 rounded-full items-center justify-center mr-3">
                    <Ionicons name={option.icon} size={18} color="#0D5E33" />
                  </View>
                  <Text
                    className="flex-1 ml-1 font-medium"
                    style={{
                      color: language === option.key ? '#0D5E33' : '#4B5563',
                      fontWeight: language === option.key ? '700' : '500',
                    }}
                  >
                    {option.label}
                  </Text>
                  {language === option.key && (
                    <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({})