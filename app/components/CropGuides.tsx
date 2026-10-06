import { useApp } from '@/app/lib/AppContext';
import { getCropImage } from '@/app/lib/cropImages';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Linking from 'expo-linking';
import Papa from 'papaparse';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { lightHaptic } from '../../lib/haptics';
import "../global.css";

// Interface matching the explicit CSV column names
interface CSVRow {
  crop_label?: string;
  fertilizer_timing?: string;
  fertilizer_method?: string;
  watering_guide?: string;
  guidance_source_title?: string;
  guidance_source_url?: string;
  pct_basis_phrase_from_watering_guide?: string;
  soil_moisture_sensor_note?: string;
  [key: string]: string | undefined;
}

function DropdownItem({
  item,
  colors,
  t,
  fs,
  topic,
}: {
  item: CSVRow;
  topic: string;
  colors: ReturnType<typeof useThemeColors>;
  t: (en: string, tl: string) => string;
  fs: (size: number) => number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [previousTopic, setPreviousTopic] = useState(topic);
  if (previousTopic !== topic) {
    setPreviousTopic(topic);
    setPage(0);
  }
  const imageSource = getCropImage(item.crop_label ?? '');
  const guides = [
    { topic: 'watering', title: t('Watering Guide', 'Gabay sa Pagdidilig'), text: item.watering_guide },
    { topic: 'fertilizer', title: t('Fertilizer Timing', 'Oras ng Pagpapataba'), text: item.fertilizer_timing },
    { topic: 'fertilizer', title: t('Fertilizer Method', 'Paraan ng Pagpapataba'), text: item.fertilizer_method },
    { topic: 'sensor', title: t('Moisture Sensor Note', 'Tala ng Sensor ng Halumigmig'), text: item.soil_moisture_sensor_note },
    { topic: 'sensor', title: t('Watering Percentage Context', 'Konteksto ng Porsyento ng Pagdidilig'), text: item.pct_basis_phrase_from_watering_guide },
  ].filter(guide => topic === 'all' || guide.topic === topic);

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: page * width, animated: false });
  }, [width, page, isOpen, topic]);

  function openSource() {
    if (!item.guidance_source_url) return;
    void Linking.openURL(item.guidance_source_url).catch(() => { Alert.alert(t('Unable to open source', 'Hindi mabuksan ang sanggunian'), t('Please try again.', 'Subukan muli.')); });
  }

  return (
    <View
      className="mb-3 overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: colors.cardBg,
        borderColor: colors.cardBorder,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      {/* Header Bar — tap to toggle */}
      <TouchableOpacity
        className="flex-row items-center justify-between p-4"
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={`${item.crop_label}. ${t('View crop guide', 'Tingnan ang gabay sa pananim')}`}
        activeOpacity={0.7}
        onPress={() => {
          lightHaptic();
          setIsOpen(!isOpen);
        }}
      >
        <View className="flex-row items-center flex-1 mr-2">
          <Image
            source={imageSource}
            style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }}
          />
          <Text
            className="capitalize flex-1"
            style={{ fontSize: fs(16), fontWeight: 'bold', color: colors.text }}
          >
            {item.crop_label || t('Unknown Crop', 'Hindi Kilalang Pananim')}
          </Text>
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.subText}
        />
      </TouchableOpacity>

      {/* Collapsible body */}
      {isOpen && (
        <View
          className="p-4 border-t"
          style={{ backgroundColor: colors.cardBgAlt, borderColor: colors.border }}
        >
          <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
            {width > 0 && <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              directionalLockEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              onMomentumScrollEnd={event => setPage(Math.max(0, Math.min(guides.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
            >
              {guides.map((guide, index) => <View key={guide.title} style={{ width, paddingHorizontal: 2 }}>
                <View style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, borderLeftWidth: 4, borderLeftColor: colors.primary }}>
                  <Text style={{ color: colors.greenText, fontWeight: '700', fontSize: fs(12), marginBottom: 8 }}>{t('Guide', 'Gabay')} {index + 1} / {guides.length}</Text>
                  <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: '700', fontSize: fs(14), marginBottom: 8 }}>{guide.title}</Text>
                  <Text style={{ color: colors.text, fontSize: fs(14), lineHeight: fs(21) }}>{guide.text || t('N/A', 'Wala')}</Text>
                </View>
              </View>)}
            </ScrollView>}
            {guides.length > 1 && <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row' }}>
                {guides.map((guide, index) => <TouchableOpacity
                  key={guide.title}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('Guide', 'Gabay')} ${index + 1}: ${guide.title}`}
                  accessibilityState={{ selected: page === index }}
                  onPress={() => setPage(index)}
                  style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{ width: page === index ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: page === index ? colors.primary : colors.border }} />
                </TouchableOpacity>)}
              </View>
              <Text style={{ color: colors.mutedText, fontSize: fs(11) }}>{t('Swipe for more guides', 'Mag-swipe para sa iba pang gabay')}</Text>
            </View>}
          </View>
          <View className="pt-3 border-t" style={{ borderColor: colors.border }}>
            <Text style={{ fontSize: fs(11), fontWeight: '700', color: colors.mutedText }}>
              {t('Source', 'Sanggunian')}
            </Text>
            {item.guidance_source_url ? (
              <TouchableOpacity
                onPress={openSource}
                accessibilityRole="link"
                accessibilityLabel={`${item.guidance_source_title}. ${t('Opens in browser.', 'Bubuksan sa browser.')}`}
                className="flex-row items-center mt-1"
              >
                <Ionicons name="open-outline" size={14} color={colors.primary} />
                <Text
                  className="ml-1 flex-1"
                        style={{ fontSize: fs(12), color: colors.primary, textDecorationLine: 'underline' }}
                >
                  {item.guidance_source_title || t('N/A', 'Wala')}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ fontSize: fs(12), color: colors.mutedText, marginTop: 2 }}>
                {item.guidance_source_title || t('N/A', 'Wala')}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export default function CropGuides() {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const fs = (size: number) => Math.round(size * fontScale);

  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [loadError, setLoadError] = useState(false);
  const topics = [
    { key: 'all', label: t('All guides', 'Lahat ng gabay') },
    { key: 'watering', label: t('Watering', 'Pagdidilig') },
    { key: 'fertilizer', label: t('Fertilizer', 'Pataba') },
    { key: 'sensor', label: t('Sensor care', 'Gabay sa sensor') },
  ];
  const filteredData = csvData.filter(item => (item.crop_label ?? '').toLowerCase().includes(query.trim().toLowerCase()));

  const loadLocalCSV = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const asset = Asset.fromModule(require('../../backend/app/machine_learning/datasets/crop-guides.csv'));
      await asset.downloadAsync();

      const fileUri = asset.localUri;
      if (!fileUri) throw new Error('Local asset URI could not be resolved.');

      const file = new File(fileUri);
      const fileContent = await file.text();

      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (response) => {
          if (response.errors.length) throw new Error('Invalid crop guide data');
          setCsvData((response.data as CSVRow[]).filter(item => item.crop_label?.trim()));
          setLoading(false);
        },
        error: (error: any) => {
          console.error('Parsing internal CSV error:', error.message);
          setLoadError(true);
          setLoading(false);
        }
      });
    } catch (error) {
      console.error('Error fetching internal file:', error);
      setLoadError(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadLocalCSV);
  }, [loadLocalCSV]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.isDarkMode ? '#102116' : '#F5F8F5' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontSize: fs(14), marginTop: 12, fontWeight: '600', color: colors.subText }}>
          {t('Loading crop guides...', 'Naglo-load ng gabay sa pananim...')}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.isDarkMode ? '#102116' : '#F5F8F5' }}>
      <FlatList
        data={filteredData}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.crop_label ?? ''}
        renderItem={({ item }) => <DropdownItem item={item} colors={colors} t={t} fs={fs} topic={topic} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={<>
          <View style={{ padding: 20, borderRadius: 20, backgroundColor: colors.headerBg, marginBottom: 20 }}>
            <Ionicons name="leaf-outline" size={28} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: fs(22), fontWeight: '700', marginTop: 12 }}>{t('Grow with confidence', 'Gabay sa iyong pagsasaka')}</Text>
            <Text style={{ color: '#D1E7D6', fontSize: fs(14), lineHeight: fs(21), marginTop: 8 }}>{t('Find your crop, choose a topic, and tap a guide for practical steps and sources.', 'Hanapin ang pananim, pumili ng paksa, at buksan ang gabay para sa mga hakbang at sanggunian.')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg, borderColor: colors.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 }}>
            <Ionicons name="search-outline" size={20} color={colors.subText} />
            <TextInput value={query} onChangeText={setQuery} placeholder={t('Search crops...', 'Maghanap ng pananim...')} placeholderTextColor={colors.subText} accessibilityLabel={t('Search crops', 'Maghanap ng pananim')} style={{ flex: 1, padding: 14, color: colors.text, fontSize: fs(15) }} />
            {!!query && <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel={t('Clear search', 'Burahin ang paghahanap')} hitSlop={10}><Ionicons name="close-circle" size={20} color={colors.subText} /></TouchableOpacity>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 16 }}>
            {topics.map(option => <TouchableOpacity key={option.key} onPress={() => setTopic(option.key)} accessibilityRole="button" accessibilityState={{ selected: topic === option.key }} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: topic === option.key ? colors.headerBg : colors.cardBg, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: topic === option.key ? '#FFFFFF' : colors.text, fontSize: fs(13), fontWeight: '600' }}>{option.label}</Text>
            </TouchableOpacity>)}
          </ScrollView>
          <Text style={{ color: colors.subText, fontSize: fs(13), marginBottom: 12 }}>{filteredData.length} {t('crop guides', 'gabay sa pananim')}</Text>
        </>}
        ListEmptyComponent={<View style={{ padding: 24, alignItems: 'center' }}>
          <Ionicons name={loadError ? 'cloud-offline-outline' : 'search-outline'} size={32} color={colors.subText} />
          <Text style={{ color: colors.text, fontSize: fs(16), fontWeight: '600', textAlign: 'center', marginTop: 12 }}>{loadError ? t('Unable to load guides', 'Hindi ma-load ang mga gabay') : t('No crops found', 'Walang nahanap na pananim')}</Text>
          <Text style={{ color: colors.subText, fontSize: fs(14), textAlign: 'center', marginTop: 8 }}>{loadError ? t('Try loading the guides again.', 'Subukang i-load muli ang mga gabay.') : t('Try another crop name or clear your search.', 'Subukan ang ibang pangalan o burahin ang paghahanap.')}</Text>
          <TouchableOpacity onPress={() => { if (loadError) { setLoading(true); setLoadError(false); void loadLocalCSV(); } else { setQuery(''); } }} style={{ backgroundColor: colors.headerBg, padding: 14, borderRadius: 12, marginTop: 16 }}><Text style={{ color: '#FFFFFF', fontSize: fs(14) }}>{loadError ? t('Retry', 'Subukan muli') : t('Clear search', 'Burahin ang paghahanap')}</Text></TouchableOpacity>
        </View>}

      />
    </View>
  );
}
