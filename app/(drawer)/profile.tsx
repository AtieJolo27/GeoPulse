import { useThemeColors } from '@/app/lib/useThemeColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/app/lib/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';


interface EditableField {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  labelKey: string;
  labelEn: string;
  labelTl: string;
  value: string;
  key: string;
}

interface Section {
  titleKey: string;
  titleEn: string;
  titleTl: string;
  items: EditableField[];
}

const DEFAULT_SECTIONS: Section[] = [
  {
    titleKey: 'personalInfo',
    titleEn: 'Personal Information',
    titleTl: 'Personal na Impormasyon',
    items: [
      { icon: 'person-outline' as const, labelKey: 'name', labelEn: 'Name', labelTl: 'Pangalan', value: '', key: 'name' },
      { icon: 'location-outline' as const, labelKey: 'location', labelEn: 'Farm Location', labelTl: 'Lokasyon ng Bukid', value: '', key: 'location' },
      { icon: 'call-outline' as const, labelKey: 'contact', labelEn: 'Contact', labelTl: 'Kontak', value: '', key: 'contact' },
    ],
  },
  {
    titleKey: 'farmDetails',
    titleEn: 'Farm Details',
    titleTl: 'Detalye ng Bukid',
    items: [
      { icon: 'map-outline' as const, labelKey: 'farmSize', labelEn: 'Farm Size', labelTl: 'Laki ng Bukid', value: '', key: 'farmSize' },
      { icon: 'leaf-outline' as const, labelKey: 'primaryCrop', labelEn: 'Primary Crop', labelTl: 'Pangunahing Pananim', value: '', key: 'primaryCrop' },
    ],
  },
];

const FARM_UNITS = [
  { value: 'ha', en: 'Hectares (ha)', tl: 'Ektarya (ha)' },
  { value: 'm²', en: 'Square meters (m²)', tl: 'Metro kuwadrado (m²)' },
  { value: 'acres', en: 'Acres', tl: 'Acres' },
];
const PROFILE_CROPS = [
  ['rice', 'Rice', 'Palay'], ['corn', 'Corn', 'Mais'], ['coconut', 'Coconut', 'Niyog'],
  ['banana', 'Banana', 'Saging'], ['sugarcane', 'Sugarcane', 'Tubo'],
  ['pineapple', 'Pineapple', 'Pinya'], ['mango', 'Mango', 'Mangga'],
  ['coffee', 'Coffee', 'Kape'], ['cacao', 'Cacao', 'Kakaw'], ['abaca', 'Abaca', 'Abaka'],
  ['cassava', 'Cassava', 'Kamoteng kahoy'], ['sweet_potato', 'Sweet potato', 'Kamote'],
  ['peanut', 'Peanut', 'Mani'], ['mungbean', 'Mung bean', 'Munggo'],
  ['eggplant', 'Eggplant', 'Talong'], ['tomato', 'Tomato', 'Kamatis'],
  ['okra', 'Okra', 'Okra'], ['ampalaya', 'Bitter melon', 'Ampalaya'],
  ['calamansi', 'Calamansi', 'Kalamansi'], ['papaya', 'Papaya', 'Papaya'],
  ['garlic', 'Garlic', 'Bawang'], ['onion', 'Onion', 'Sibuyas'],
  ['tobacco', 'Tobacco', 'Tabako'], ['rubber', 'Rubber', 'Goma'],
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { language, t, user, login, loading, fontScale, zones } = useApp();

  const metadata = user?.user_metadata ?? {};
  const sections: Section[] = DEFAULT_SECTIONS.map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      value: item.key === 'name' ? metadata.full_name ?? '' : metadata.farm_profile?.[item.key] ?? '',
    })),
  }));
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingItem, setEditingItem] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [farmUnit, setFarmUnit] = useState('ha');
  const cropLabel = (value: string) => {
    const option = PROFILE_CROPS.find(([key]) => key === value);
    return option ? t(option[1], option[2]) : value;
  };

  const farmerName = metadata.full_name ?? '';
  const farmerRole = metadata.role_location ?? '';
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [editNameValue, setEditNameValue] = useState(farmerName);
  const [editRoleValue, setEditRoleValue] = useState(farmerRole);
  const [saving, setSaving] = useState(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const saveProfile = async (updatedSections: Section[], name: string, role: string) => {
    setSaving(true);
    try {
      const farmProfile = {
        ...metadata.farm_profile,
        ...Object.fromEntries(updatedSections.flatMap(section => section.items.map(item => [item.key, item.value]))),
      };
      const { error } = await supabase.auth.updateUser({ data: { full_name: name, role_location: role, farm_profile: farmProfile } });
      if (error) throw error;
      return true;
    } catch (error) {
      Alert.alert(t('Unable to save', 'Hindi ma-save'), error instanceof Error ? error.message : t('Please try again.', 'Subukan muli.'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (section: Section, item: EditableField) => {
    setEditingSection(section);
    setEditingItem(item);
    setEditValue(item.value);
    if (item.key === 'farmSize') {
      const parsed = item.value.trim().match(/^([\d.,]+)\s*(ha|m²|m2|sqm|acres?)$/i);
      setEditValue(parsed ? parsed[1] : item.value);
      const unit = parsed?.[2].toLowerCase();
      setFarmUnit(unit === 'sqm' || unit === 'm2' || unit === 'm²' ? 'm²' : unit?.startsWith('acre') ? 'acres' : 'ha');
    }
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSection || !editingItem) return;
    let savedValue = editValue.trim();
    if (editingItem.key === 'farmSize') {
      const amount = Number(savedValue.replace(',', '.'));
      if (!savedValue || !Number.isFinite(amount) || amount <= 0) {
        Alert.alert(t('Invalid farm size', 'Hindi wastong laki ng bukid'), t('Enter a number greater than zero and select its unit.', 'Maglagay ng numerong higit sa zero at piliin ang yunit.'));
        return;
      }
      savedValue = `${amount} ${farmUnit}`;
    }
    if (editingItem.key === 'primaryCrop' && !savedValue) {
      Alert.alert(t('Select a crop', 'Pumili ng pananim'));
      return;
    }

    const updatedSections = sections.map((sec) => {
      if (sec.titleKey === editingSection.titleKey) {
        return {
          ...sec,
          items: sec.items.map((it) => {
            if (it.key === editingItem.key) {
              return { ...it, value: savedValue };
            }
            return it;
          }),
        };
      }
      return sec;
    });

    if (!await saveProfile(updatedSections, editingItem.key === 'name' ? editValue.trim() : farmerName, farmerRole)) return;
    setEditModalVisible(false);
    setEditingSection(null);
    setEditingItem(null);
    setEditValue('');

    Alert.alert(
      t('Saved', 'Na-save'),
      t('Your information has been updated successfully.', 'Matagumpay na na-update ang iyong impormasyon.')
    );
  };

  const handleSaveName = async () => {

    const updatedSections = sections.map((sec) => {
      if (sec.titleKey === 'personalInfo') {
        return {
          ...sec,
          items: sec.items.map((it) => {
            if (it.key === 'name') {
              return { ...it, value: editNameValue.trim() };
            }
            return it;
          }),
        };
      }
      return sec;
    });
    if (!await saveProfile(updatedSections, editNameValue.trim(), editRoleValue.trim())) return;
    setEditNameVisible(false);

    Alert.alert(
      t('Saved', 'Na-save'),
      t('Your name has been updated successfully.', 'Matagumpay na na-update ang iyong pangalan.')
    );
  };

  const bgColor = colors.bg;
  const cardBg = colors.cardBg;
  const textColor = colors.text;
  const subTextColor = colors.subText;
  const borderColor = colors.border;
  const headerBg = colors.headerBg;
    const fs = (size: number) => size * fontScale;

  // If user is not logged in, show login form
  if (!user) {
    return (
      <View className="flex-1" style={{ backgroundColor: bgColor, paddingBottom: insets.bottom }}>
        {/* Header — no back button here on purpose; login is the auth gate */}
        <View className="pt-12 pb-8 px-6 rounded-b-3xl" style={{ backgroundColor: headerBg, paddingTop: insets.top + 12 }}>
          <View className="flex-row items-center justify-between mb-4">
            <View style={{ width: 24 }} />
            <Text className="text-white font-bold text-lg">
              {t('Login', 'Mag-login')}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <View className="items-center">
            <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-3 relative">
              <Ionicons name="person" size={40} color="white" />
            </View>
            <Text className="text-white font-bold text-xl">
              GeoPulse
            </Text>
          </View>
        </View>

        {/* Login Form */}
        <ScrollView className="flex-1 px-4 -mt-4">
          <View className="rounded-2xl p-4 mb-4 shadow-sm" style={{ backgroundColor: cardBg, borderColor: borderColor, borderWidth: 1 }}>
            <Text className="font-semibold text-sm uppercase tracking-wide mb-3" style={{ color: subTextColor }}>
              {t('Welcome Back', 'Maligayang Pagbabalik')}
            </Text>

            {/* Email Input */}
            <View className="mb-4">
              <Text className="text-sm font-medium mb-2" style={{ color: textColor }}>
                {t('Email', 'Email')}
              </Text>
              <TextInput
                className="rounded-xl p-3"
                style={{ borderWidth: 1, borderColor, color: textColor, backgroundColor: colors.inputBg, fontSize: fs(16) }}
                placeholderTextColor={subTextColor}
                value={email}
                onChangeText={setEmail}
                placeholder={t('Enter your email', 'Ilagay ang iyong email')}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            {/* Password Input */}
            <View className="mb-4">
              <Text className="text-sm font-medium mb-2" style={{ color: textColor }}>
                {t('Password', 'Password')}
              </Text>
              <TextInput
                className="rounded-xl p-3"
                style={{ borderWidth: 1, borderColor, color: textColor, backgroundColor: colors.inputBg, fontSize: fs(16) }}
                placeholderTextColor={subTextColor}
                value={password}
                onChangeText={setPassword}
                placeholder={t('Enter your password', 'Ilagay ang iyong password')}
                secureTextEntry={true}
                autoComplete="current-password"
              />
            </View>

            {/* Error Message */}
            {loginError && (
              <View className="mb-3 p-3 rounded-lg" style={{ backgroundColor: cardBg, borderColor: colors.danger, borderWidth: 1 }}>
                <Text className="text-sm font-medium" style={{ color: colors.danger }}>
                  {loginError}
                </Text>
              </View>
            )}

            {/* Login Button */}
            <TouchableOpacity
              onPress={async () => {
                setLoginError(null);
                try {
                  await login(email, password);
                  setEmail('');
                  setPassword('');
                  router.replace('/(drawer)/(tabs)/home');
                } catch (error: any) {
                  setLoginError(error.message ?? 'Login failed');
                }
              }}
              className="flex-row items-center justify-center rounded-2xl p-4 mb-6"
              style={{ backgroundColor: colors.primary }}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
              ) : null}
              <Text className="text-white font-semibold">
                {t('Login', 'Mag-login')}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View className="mb-4 flex-row items-center">
              <View className="flex-1 h-0.5" style={{ backgroundColor: borderColor }} />
              <Text className="px-2 text-sm" style={{ color: subTextColor }}>
                {t('Or', 'O')}
              </Text>
              <View className="flex-1 h-0.5" style={{ backgroundColor: borderColor }} />
            </View>

            {/* Sign Up Link */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(t('Sign Up', 'Sign Up'), t('Sign up feature coming soon.', 'Siguro na darating ang feature ng sign up.'));
              }}
              className="flex-row items-center justify-center"
            >
              <Text className="text-sm font-medium" style={{ color: colors.greenText }}>
                {t("Don't have an account? Sign up", "Walang account? Mag-sign up")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // If user is logged in, show the profile screen
  return (
    <View className="flex-1" style={{ backgroundColor: bgColor, paddingBottom: insets.bottom }}>
      {/* Header */}
      <View className="pt-12 pb-8 px-6 rounded-b-3xl" style={{ backgroundColor: headerBg, paddingTop: insets.top + 12, shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}>
        <View className="flex-row items-center justify-between mb-4">
          {router.canGoBack() ? (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: fs(18) }}>
            {t('Profile', 'Profile')}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View className="items-center">
          <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-3 relative">
            <Ionicons name="person" size={40} color="white" />
          </View>
          <View className="flex-row items-center">
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: fs(20) }}>{farmerName || t('Your Profile', 'Iyong Profile')}</Text>
            <TouchableOpacity
              onPress={() => {
                setEditNameValue(farmerName);
                setEditRoleValue(farmerRole);
                setEditNameVisible(true);
              }}
              className="ml-2 bg-white/20 rounded-full p-1.5"
            >
              <Ionicons name="pencil" size={14} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: fs(14) }}>{farmerRole || t('Farmer', 'Magsasaka')}</Text>
        </View>
      </View>

      {/* Profile Sections */}
      <ScrollView className="flex-1 px-4 -mt-4">
        {sections.map((section, sIndex) => (
          <View
            key={sIndex}
            className="rounded-2xl p-4 mb-4 shadow-sm"
            style={{ backgroundColor: cardBg, borderColor: borderColor, borderWidth: 1 }}
          >
            <Text style={{ color: subTextColor, fontWeight: '600', fontSize: fs(12), letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
              {t(section.titleEn, section.titleTl)}
            </Text>
            {section.items.map((item, iIndex) => (
              <TouchableOpacity
                key={iIndex}
                onPress={() => handleOpenEdit(section, item)}
                className="flex-row items-center py-3"
                style={{
                  borderBottomWidth: iIndex === section.items.length - 1 ? 0 : 1,
                  borderBottomColor: borderColor,
                }}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.progressTrack }}>
                  <Ionicons name={item.icon} size={16} color={colors.greenText} />
                </View>
                <View className="flex-1">
                  <Text style={{ color: textColor, fontWeight: '500', fontSize: fs(14) }}>
                    {language === 'tagalog' ? item.labelTl : item.labelEn}
                  </Text>
                  <Text style={{ color: subTextColor, fontSize: fs(12), marginTop: 2 }}>
                    {(item.key === 'primaryCrop' ? cropLabel(item.value) : item.value) || t('Not provided', 'Hindi pa nailagay')}
                  </Text>
                </View>
                <Ionicons name="pencil-outline" size={16} color={colors.mutedText} />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        

        <View className="rounded-2xl p-4 mb-6" style={{ backgroundColor: cardBg, borderColor, borderWidth: 1 }}>
          <Text style={{ color: textColor, fontSize: fs(16), fontWeight: '600' }}>{t('Account', 'Account')}</Text>
          <Text style={{ color: subTextColor, fontSize: fs(14), marginTop: 8 }}>{user.email}</Text>
          <Text style={{ color: subTextColor, fontSize: fs(14), marginTop: 8 }}>{t('Farm Zones', 'Mga Sona ng Bukid')}: {zones.length}</Text>
          <TouchableOpacity onPress={() => router.push('/settings')} className="flex-row items-center py-4">
            <Ionicons name="settings-outline" size={20} color={textColor} />
            <Text style={{ color: textColor, fontSize: fs(14), marginLeft: 12 }}>{t('App Settings', 'Mga Setting ng App')}</Text>
            <Ionicons name="chevron-forward" size={18} color={subTextColor} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Field Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="rounded-2xl w-full p-6" style={{ backgroundColor: cardBg }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: textColor, fontSize: fs(18), fontWeight: '700' }}>
                {t('Edit', 'Baguhin')} {editingItem ? (language === 'tagalog' ? editingItem.labelTl : editingItem.labelEn) : ''}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            {editingItem?.key === 'primaryCrop' ? (
              <ScrollView style={{ maxHeight: 280, marginBottom: 16 }} keyboardShouldPersistTaps="handled">
                {editingItem.value && !PROFILE_CROPS.some(([key]) => key === editingItem.value) && (
                  <TouchableOpacity accessibilityRole="radio" accessibilityState={{ checked: editValue === editingItem.value }} onPress={() => setEditValue(editingItem.value)} style={{ padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: editValue === editingItem.value ? colors.progressTrack : colors.inputBg }}>
                    <Text style={{ color: textColor }}>{editingItem.value}</Text>
                  </TouchableOpacity>
                )}
                {PROFILE_CROPS.map(([value, en, tl]) => (
                  <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: editValue === value }} onPress={() => setEditValue(value)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, minHeight: 48, borderRadius: 12, marginBottom: 6, backgroundColor: editValue === value ? colors.progressTrack : colors.inputBg }}>
                    <Text style={{ color: textColor, fontSize: fs(16), flexShrink: 1 }}>{t(en, tl)}</Text>
                    {editValue === value && <Ionicons name="checkmark" size={20} color={colors.greenText} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : <TextInput
              className="rounded-xl p-3 mb-4"
              style={{ color: textColor, backgroundColor: colors.inputBg, borderColor, borderWidth: 1, fontSize: fs(16) }}
              placeholderTextColor={subTextColor}
              value={editValue}
              keyboardType={editingItem?.key === 'farmSize' ? 'decimal-pad' : 'default'}
              onChangeText={setEditValue}
              placeholder={t('Enter', 'Ilagay ang') + ' ' + (editingItem ? (language === 'tagalog' ? editingItem.labelTl.toLowerCase() : editingItem.labelEn.toLowerCase()) : '')}
              autoFocus
            />}
            {editingItem?.key === 'farmSize' && <View style={{ marginBottom: 16 }}>
              <Text style={{ color: subTextColor, fontSize: fs(13), marginBottom: 8 }}>{t('Area unit', 'Yunit ng lawak')}</Text>
              <View style={{ gap: 8 }}>
                {FARM_UNITS.map(unit => <TouchableOpacity key={unit.value} accessibilityRole="radio" accessibilityState={{ checked: farmUnit === unit.value }} onPress={() => setFarmUnit(unit.value)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: farmUnit === unit.value ? colors.primary : borderColor, backgroundColor: farmUnit === unit.value ? colors.progressTrack : colors.inputBg }}>
                  <Text style={{ color: textColor, fontSize: fs(14) }}>{t(unit.en, unit.tl)}</Text>
                  {farmUnit === unit.value && <Ionicons name="checkmark" size={18} color={colors.greenText} />}
                </TouchableOpacity>)}
              </View>
            </View>}

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                className="flex-1 rounded-xl py-3 items-center"
                style={{ backgroundColor: colors.cardBgAlt }}
              >
                <Text style={{ color: textColor, fontWeight: '600' }}>
                  {t('Cancel', 'Kanselahin')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={saving}
                onPress={handleSaveEdit}
                className="flex-1 rounded-xl py-3 items-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-white font-semibold">
                  {saving ? t('Saving?', 'Nagse-save?') : t('Save', 'I-save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Name Modal */}
      <Modal visible={editNameVisible} transparent animationType="fade" onRequestClose={() => setEditNameVisible(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="rounded-2xl w-full p-6" style={{ backgroundColor: cardBg }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: textColor, fontSize: fs(18), fontWeight: '700' }}>
                {t('Edit Profile', 'Baguhin ang Profile')}
              </Text>
              <TouchableOpacity onPress={() => setEditNameVisible(false)}>
                <Ionicons name="close" size={24} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-semibold uppercase mb-1" style={{ color: subTextColor }}>
              {t('Full Name', 'Buong Pangalan')}
            </Text>
            <TextInput
              className="rounded-xl p-3 mb-4"
              style={{ color: textColor, backgroundColor: colors.inputBg, borderColor, borderWidth: 1, fontSize: fs(16) }}
              placeholderTextColor={subTextColor}
              value={editNameValue}
              onChangeText={setEditNameValue}
              placeholder={t('Enter your full name', 'Ilagay ang iyong buong pangalan')}
              autoFocus
            />

            <Text className="text-xs font-semibold uppercase mb-1" style={{ color: subTextColor }}>
              {t('Role / Location', 'Tungkulin / Lokasyon')}
            </Text>
            <TextInput
              className="rounded-xl p-3 mb-4"
              style={{ color: textColor, backgroundColor: colors.inputBg, borderColor, borderWidth: 1, fontSize: fs(16) }}
              placeholderTextColor={subTextColor}
              value={editRoleValue}
              onChangeText={setEditRoleValue}
              placeholder={t('e.g. Farmer', 'Hal. Magsasaka') + ' • Nueva Ecija'}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setEditNameVisible(false)}
                className="flex-1 rounded-xl py-3 items-center"
                style={{ backgroundColor: colors.cardBgAlt }}
              >
                <Text style={{ color: textColor, fontWeight: '600' }}>
                  {t('Cancel', 'Kanselahin')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={saving}
                onPress={handleSaveName}
                className="flex-1 rounded-xl py-3 items-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-white font-semibold">
                  {saving ? t('Saving?', 'Nagse-save?') : t('Save', 'I-save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      
    </View>
  );
}
