import { useApp } from '@/app/lib/AppContext';
import { getCropImage } from '@/app/lib/cropImages';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as Linking from 'expo-linking';
import Papa from 'papaparse';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
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
  [key: string]: any;
}

function DropdownItem({
  item,
  colors,
  t,
  fs,
}: {
  item: CSVRow;
  colors: ReturnType<typeof useThemeColors>;
  t: (en: string, tl: string) => string;
  fs: (size: number) => number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const imageSource = getCropImage(item.crop_label ?? '');

  function openSource() {
    if (!item.guidance_source_url) return;
    void Linking.openURL(item.guidance_source_url).catch(() => {});
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
            numberOfLines={1}
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
          <View className="mb-3">
            <Text
              className="uppercase"
              style={{ fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, color: colors.primary }}
            >
              {t('Watering Guide', 'Gabay sa Pagdidilig')}
            </Text>
            <Text style={{ fontSize: fs(14), lineHeight: fs(20), marginTop: 2, color: colors.subText }}>
              {item.watering_guide || t('N/A', 'Wala')}
            </Text>
          </View>

          <View className="mb-3">
            <Text
              className="uppercase"
              style={{ fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, color: colors.primary }}
            >
              {t('Fertilizer Timing', 'Oras ng Pagpapataba')}
            </Text>
            <Text style={{ fontSize: fs(14), lineHeight: fs(20), marginTop: 2, color: colors.subText }}>
              {item.fertilizer_timing || t('N/A', 'Wala')}
            </Text>
          </View>

          <View className="mb-3">
            <Text
              className="uppercase"
              style={{ fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, color: colors.primary }}
            >
              {t('Fertilizer Method', 'Paraan ng Pagpapataba')}
            </Text>
            <Text style={{ fontSize: fs(14), lineHeight: fs(20), marginTop: 2, color: colors.subText }}>
              {item.fertilizer_method || t('N/A', 'Wala')}
            </Text>
          </View>

          <View className="mb-3">
            <Text
              className="uppercase"
              style={{ fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, color: colors.primary }}
            >
              {t('Moisture Sensor Note', 'Tala ng Sensor ng Halumigmig')}
            </Text>
            <Text style={{ fontSize: fs(14), lineHeight: fs(20), marginTop: 2, color: colors.subText }}>
              {item.soil_moisture_sensor_note || t('N/A', 'Wala')}
            </Text>
          </View>

          <View className="mb-3">
            <Text
              className="uppercase"
              style={{ fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, color: colors.primary }}
            >
              {t('Watering Percentage Context', 'Konteksto ng Porsyento ng Pagdidilig')}
            </Text>
            <Text style={{ fontSize: fs(14), lineHeight: fs(20), marginTop: 2, color: colors.subText }}>
              {item.pct_basis_phrase_from_watering_guide || t('N/A', 'Wala')}
            </Text>
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
                  numberOfLines={1}
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

  useEffect(() => {
    loadLocalCSV();
  }, []);

  const loadLocalCSV = async () => {
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
          setCsvData(response.data as CSVRow[]);
          setLoading(false);
        },
        error: (error: any) => {
          console.error('Parsing internal CSV error:', error.message);
          setLoading(false);
        }
      });
    } catch (error) {
      console.error('Error fetching internal file:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontSize: fs(14), marginTop: 12, fontWeight: '600', color: colors.subText }}>
          {t('Loading crop guides...', 'Naglo-load ng gabay sa pananim...')}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg }}>
      <FlatList
        data={csvData}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => <DropdownItem item={item} colors={colors} t={t} fs={fs} />}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
}