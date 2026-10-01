import { DashboardSkeleton } from '@/app/components/LoadingSkeleton';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { StatusBadge } from '@/app/components/ui/StatusBadge';
import { useApp } from '@/app/lib/AppContext';
import { getCropImage } from '@/app/lib/cropImages';
import { useThemeColors } from '@/app/lib/useThemeColors';
import DailyCropTips from '@/components/DailyCropTips';
import PlantingDatePicker from '@/components/PlantingDatePicker';
import { validPlantingDate } from '@/lib/plantingDate';
import { computeSoilHealthScore, SENSOR_REFERENCE_RANGES } from '@/lib/soilHealthScore';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import * as Progress from 'react-native-progress';
import { CACHE_KEYS, getCache, setCache } from '../../../../lib/cache';
import { exportSensorReadingsPdf } from '../../../../lib/exportSensorReadings';
import { lightHaptic, mediumHaptic, warningHaptic } from '../../../../lib/haptics';
import { supabase } from '../../../../lib/supabaseClient';
import Urgent_Card from '../../../components/UrgentCard';

const OPTIMAL_RANGES = {
  soil_moisture: { min: 70, max: 75, unit: '%' },
  soil_temperature: { min: 20, max: 30, unit: '°C' },
  ...SENSOR_REFERENCE_RANGES,
} as const;

interface SensorReading {
  zone_id?: number | string | null;
  id?: string | number;
  created_at?: string;
  soil_moisture?: number | string;
  soil_temperature?: number | string;
  ph?: number | string;
  nitrogen?: number | string;
  phosphorus?: number | string;
  potassium?: number | string;
  [key: string]: any;
}

interface SensorAlert {
  field: string;
  fieldTl: string;
  message: string;
  messageTl: string;
  date: string;
  dateTl: string;
  severity: 'high' | 'medium' | 'low';
}

function getTimeAgo(date: Date, now: Date): { en: string; tl: string } {
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return { en: 'Just now', tl: 'Ngayon lang' };
  if (diffMins < 60) return { en: `${diffMins} min ago`, tl: `${diffMins} minuto ang nakalipas` };
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { en: `${diffHours} hr ago`, tl: `${diffHours} oras ang nakalipas` };
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return { en: '1 day ago', tl: '1 araw ang nakalipas' };
  return { en: `${diffDays} days ago`, tl: `${diffDays} araw ang nakalipas` };
}

function computeAlerts(record: SensorReading | null): SensorAlert[] {
  if (!record) return [];

  const alerts: SensorAlert[] = [];
  const now = new Date();
  const recordDate = record.created_at ? new Date(record.created_at) : now;
  const timeAgo = getTimeAgo(recordDate, now);

  const temp = parseFloat(String(record.soil_temperature));
  if (!isNaN(temp)) {
    if (temp > OPTIMAL_RANGES.soil_temperature.max + 5) {
      alerts.push({
        field: 'Soil Temperature',
        fieldTl: 'Temperatura ng Lupa',
        message: `Temperature too high (${temp}°C), exceeds optimal range`,
        messageTl: `Masyadong mataas ang temperatura (${temp}°C), lampas sa optimal na antas`,
        date: timeAgo.en,
        dateTl: timeAgo.tl,
        severity: 'high',
      });
    } else if (temp < OPTIMAL_RANGES.soil_temperature.min - 5) {
      alerts.push({
        field: 'Soil Temperature',
        fieldTl: 'Temperatura ng Lupa',
        message: `Temperature too low (${temp}°C), below optimal range`,
        messageTl: `Masyadong mababa ang temperatura (${temp}°C), mababa sa optimal na antas`,
        date: timeAgo.en,
        dateTl: timeAgo.tl,
        severity: 'medium',
      });
    }
  }

  const moisture = parseFloat(String(record.soil_moisture));
  if (!isNaN(moisture)) {
    if (moisture < OPTIMAL_RANGES.soil_moisture.min - 10) {
      alerts.push({
        field: 'Soil Moisture',
        fieldTl: 'Halumigmig ng Lupa',
        message: `Moisture level too low (${moisture}%)`,
        messageTl: `Masyadong mababa ang antas ng kahalumigmigan (${moisture}%)`,
        date: timeAgo.en,
        dateTl: timeAgo.tl,
        severity: 'high',
      });
    } else if (moisture > OPTIMAL_RANGES.soil_moisture.max + 10) {
      alerts.push({
        field: 'Soil Moisture',
        fieldTl: 'Halumigmig ng Lupa',
        message: `Moisture level too high (${moisture}%) — risk of waterlogging`,
        messageTl: `Masyadong mataas ang antas ng kahalumigmigan (${moisture}%) — peligro ng pagbaha`,
        date: timeAgo.en,
        dateTl: timeAgo.tl,
        severity: 'medium',
      });
    }
  }

  const ph = parseFloat(String(record.ph));
  if (!isNaN(ph)) {
    if (ph < OPTIMAL_RANGES.ph.min - 0.5) {
      alerts.push({
        field: 'Soil pH',
        fieldTl: 'Antas ng pH',
        message: `Soil too acidic (pH ${ph}), below optimal range`,
        messageTl: `Masyadong acidic ang lupa (pH ${ph}), mababa sa optimal na antas`,
        date: timeAgo.en,
        dateTl: timeAgo.tl,
        severity: 'high',
      });
    } else if (ph > OPTIMAL_RANGES.ph.max + 0.5) {
      alerts.push({
        field: 'Soil pH',
        fieldTl: 'Antas ng pH',
        message: `Soil too alkaline (pH ${ph}), above optimal range`,
        messageTl: `Masyadong alkaline ang lupa (pH ${ph}), mataas sa optimal na antas`,
        date: timeAgo.en,
        dateTl: timeAgo.tl,
        severity: 'medium',
      });
    }
  }

  return alerts;
}

function computeHealthScore(record: SensorReading | null) {
  const result = computeSoilHealthScore(record ?? {});
  return {
    score: result.overall ?? 0,
    available: result.overall !== null,
    needsAttention: result.needsAttention,
    completeness: `${result.validCount}/${result.totalCount}`,
    breakdown: result.factors.map(f => ({
      label: `${f.label} (${f.optimalMin}-${f.optimalMax} ${f.unit}) - ${f.status}`,
      score: f.score ?? 0,
      available: f.score !== null,
      max: 100,
    })),
    interpretation: result.interpretation,
  };
}

export default function HomeScreen() {
  const {
    t,
    fontScale,
    zones,
    activeZoneId,
    setActiveZoneId,
    createZone,
    setPlantedCrop,
  } = useApp();
  const colors = useThemeColors();
  const fs = (size: number) => Math.round(size * fontScale);

  const [scoreCardWidth, setScoreCardWidth] = useState(0);
  const [modalVisible, setModalVisibility] = useState(false);
  const [data, setData] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newZoneNameEn, setNewZoneNameEn] = useState('');
  const [newZoneNameTl, setNewZoneNameTl] = useState('');
  const [addZoneModalVisible, setAddZoneModalVisible] = useState(false);
  const [selectedSoilType, setSelectedSoilType] = useState<string | null>(null);
  const [savingZone, setSavingZone] = useState(false);
  const [plantModalVisible, setPlantModalVisible] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [savingCrop, setSavingCrop] = useState(false);
  const [plantingDate, setPlantingDate] = useState('');

  const PHILIPPINE_CROPS = [
    'rice', 'corn', 'coconut', 'banana', 'sugarcane', 'pineapple', 'mango',
    'coffee', 'cacao', 'abaca', 'cassava', 'sweet_potato', 'peanut',
    'mungbean', 'eggplant', 'tomato', 'okra', 'ampalaya', 'calamansi',
    'papaya', 'garlic', 'onion', 'tobacco', 'rubber',
  ];

  const SOIL_TYPES = [
    'Clay',
    'Clay Loam',
    'Loam',
    'Sandy',
    'Sandy Loam',
    'Silty Clay Loam',
    'Volcanic Loam',
  ];
  const [isExporting, setIsExporting] = useState(false);
  const readingRequest = useRef(0);

  const fetchData = useCallback(async () => {
    const requestId = ++readingRequest.current;
    if (activeZoneId === null) {
      setData([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const cacheKey = `${CACHE_KEYS.SENSOR_READINGS}:zone:${activeZoneId}`;
    try {
      setError(null);

      const cached = await getCache<SensorReading[]>(cacheKey);
      if (requestId !== readingRequest.current) return;
      if (cached && cached.length > 0) {
        setData(cached);
        setLoading(false);
      }

      const { data: fetchedData, error: fetchError } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('zone_id', activeZoneId)
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });

      if (requestId !== readingRequest.current) return;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const orderedData = fetchedData ?? [];
      setData(orderedData);

      await setCache(cacheKey, orderedData);
    } catch (err: any) {
      if (requestId !== readingRequest.current) return;
      console.warn('fetchData error:', err);
      setError(err.message || 'Failed to fetch sensor data');
      const cached = await getCache<SensorReading[]>(cacheKey);
      if (cached && requestId === readingRequest.current) {
        setData((prev) => (prev.length === 0 ? cached : prev));
      }
    } finally {
      if (requestId === readingRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeZoneId]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('sensor_readings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensor_readings' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      readingRequest.current++;
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    lightHaptic();
    fetchData();
  }, [fetchData]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportSensorReadingsPdf(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to export sensor readings.';
      Alert.alert('Export failed', message);
    } finally {
      setIsExporting(false);
    }
  }, [data]);

  const latestRecord = useMemo(() => {
    if (activeZoneId === null) return null;
    // Data is ordered newest first. Never attribute unassigned readings to a zone.
    return data.find(reading => reading.zone_id != null && String(reading.zone_id) === String(activeZoneId)) ?? null;
  }, [data, activeZoneId]);

  const getSensorValue = useCallback((field: keyof SensorReading, defaultValue: string = '--') => {
    if (!latestRecord) return defaultValue;
    const value = latestRecord[field];
    return value !== undefined && value !== null ? String(value) : defaultValue;
  }, [latestRecord]);

  const getProgressValue = useCallback((value: any, maxValue: number): number => {
    if (value === null || value === undefined) return 0;
    const numValue = parseFloat(String(value));
    return isNaN(numValue) ? 0 : Math.min(numValue / maxValue, 1);
  }, []);

  const alerts = useMemo(() => computeAlerts(latestRecord), [latestRecord]);
  const healthInfo = useMemo(() => computeHealthScore(latestRecord), [latestRecord]);

  if (loading && data.length === 0) {
    return <DashboardSkeleton />;
  }

  if (error && data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.bg }}>
        <Ionicons name="cloud-offline-outline" size={64} color={colors.greenText} />
        <Text className="text-lg font-bold mt-4 text-center" style={{ color: colors.text }}>
          {t('Connection Error', 'Error sa Koneksyon')}
        </Text>
        <Text className="text-sm mt-2 text-center" style={{ color: colors.subText }}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={fetchData}
          className="mt-6 rounded-xl py-3 px-8"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="font-bold" style={{ color: '#F0FDF4' }}>
            {t('Retry', 'Subukan Muli')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const zoneObj = zones.find(z => z.id === activeZoneId);
  const zoneLabelEn = zoneObj?.name_en ?? 'Zone';
  const zoneLabelTl = zoneObj?.name_tl ?? 'Sona';
  const totalAlerts = alerts.length;
  const hasPlantedCrop = Boolean(zoneObj?.current_crop);
  const scoreVisualSize = hasPlantedCrop
    ? Math.min(132, Math.max(1, ((scoreCardWidth || 240) - 16) / 2))
    : Math.min(184, scoreCardWidth || 184);
  const scoreColor = !healthInfo.available ? colors.mutedText
    : healthInfo.needsAttention ? '#CA8A04' : colors.primary;


  return (
    <ScrollView
      className="flex-1 px-7 py-5"
      contentContainerStyle={{ paddingBottom: 100 }}
      style={{ backgroundColor: colors.bg }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary, colors.primaryLight]}
        />
      }
    >
      <View>
        <View className="mb-6 mt-2">
          <Text style={{ fontSize: fs(14), color: colors.subText }}>{t('Good day', 'Magandang araw')}</Text>
          <Text style={{ fontSize: fs(26), fontWeight: '800', color: colors.text }}>
            {t('How is your field today?', 'Kumusta ang inyong bukid ngayon?')}
          </Text>
          <Text className="mt-1" style={{ fontSize: fs(13), color: colors.mutedText }}>
            {t('Live soil conditions and practical next steps.', 'Live na kondisyon ng lupa at praktikal na susunod na hakbang.')}
          </Text>
        </View>
        {/* Zone selector */}
        <View className="mt-4">
          <Text style={{ fontSize: fs(12), fontWeight: '800', letterSpacing: 0.9, color: colors.subText }}>
            {t('FIELD ZONES', 'SONA NG LARANGAN')}
          </Text>
        </View>
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
          {zones.map((zone) => (
            <TouchableOpacity
              key={zone.id}
              onPress={async () => {
                lightHaptic();
                await setActiveZoneId(zone.id);
              }}
              className="border rounded-2xl px-3 py-2"
              style={{
                width: 118,
                minHeight: 64,
                backgroundColor: activeZoneId === zone.id ? colors.primary : colors.cardBgAlt,
                borderColor: activeZoneId === zone.id ? colors.primary : colors.border,
                shadowColor: activeZoneId === zone.id ? colors.primary : 'transparent',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: activeZoneId === zone.id ? 0.3 : 0,
                shadowRadius: 4,
                elevation: activeZoneId === zone.id ? 4 : 0,
              }}
              accessibilityRole="button"
              accessibilityLabel={t(`Select ${zone.name_en}`, `Piliin ang ${zone.name_tl}`)}
            >
              <Text
                numberOfLines={1}
                style={{ fontSize: fs(14), fontWeight: 'bold', textAlign: 'center', color: activeZoneId === zone.id ? 'white' : colors.text }}
              >
                {t(zone.name_en, zone.name_tl)}
              </Text>
              <View
                style={{
                  alignSelf: 'center',
                  marginTop: 4,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 10,
                  backgroundColor: activeZoneId === zone.id ? 'rgba(255,255,255,0.2)' : colors.bg,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontSize: fs(10), fontWeight: '700', color: activeZoneId === zone.id ? 'white' : colors.primary }}
                >
                  {zone.soil_type}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => {
              lightHaptic();
              setNewZoneNameEn('');
              setNewZoneNameTl('');
              setAddZoneModalVisible(true);
            }}
            className="border rounded-2xl h-13 p-4"
            style={{
              width: 80,
              backgroundColor: colors.cardBgAlt,
              borderColor: colors.border,
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Add zone', 'Magdagdag na zona')}
          >
            <Ionicons name="add" size={24} color={colors.primary} />
          </TouchableOpacity>
        </ScrollView>

        <View className="my-2">
          <Text style={{ fontSize: fs(16), fontWeight: 'bold', marginTop: 16, color: colors.subText }}>
            {t(zoneLabelEn, zoneLabelTl)}
          </Text>
          <Text style={{ marginTop: 4, fontSize: fs(12), color: colors.mutedText }}>
            {latestRecord?.created_at && Number.isFinite(Date.parse(latestRecord.created_at))
              ? `${t('Last recorded', 'Huling naitala')}: ${new Date(latestRecord.created_at).toLocaleString()}`
              : t('No dated readings loaded for this zone.', 'Walang datos na may petsa para sa sonang ito.')}
          </Text>
        </View>

        {/* Soil Health Score */}
        <SectionHeader
          title={t('Sensor condition index', 'Index ng kondisyon')}
          subtitle={`${healthInfo.completeness} ${t('valid readings - provisional', 'wastong datos - pansamantala')}`}
          action={<StatusBadge label={!healthInfo.available ? t('Incomplete data', 'Kulang na datos') : healthInfo.needsAttention ? t('Check readings', 'Suriin ang datos') : t('Within reference bands', 'Nasa saklaw')} tone={!healthInfo.available ? 'neutral' : healthInfo.needsAttention ? 'warning' : 'healthy'} />}
        />
        <View
          className="border rounded-3xl p-5"
          style={{
            borderColor: colors.soilCardBorder,
            backgroundColor: colors.soilCardBg,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          <View className="flex-row justify-between">
            <TouchableOpacity
              onPress={() => {
                mediumHaptic();
                setModalVisibility(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('View sensor index details', 'Tingnan ang detalye ng index')}
            >
              <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
            {/* Change planted crop */}

            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.cardBgAlt }}>
              <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                {t('Details', 'Detalye')}
              </Text>
            </View>
          </View>
          <View className="mt-4">

            <View onLayout={({ nativeEvent }) => setScoreCardWidth(nativeEvent.layout.width)}>
              <View style={{ width: '100%', flexDirection: hasPlantedCrop ? 'row' : 'column', alignItems: 'flex-start' }}>
                <View style={{ width: hasPlantedCrop ? '50%' : '100%', flexGrow: 0, flexShrink: 0, alignItems: 'center', paddingRight: hasPlantedCrop ? 8 : 0 }}>
                  <AnimatedCircularProgress
                    size={scoreVisualSize}
                    width={hasPlantedCrop ? 7 : 10}
                    fill={healthInfo.score}
                    tintColor={scoreColor}
                    backgroundColor={colors.progressTrack}
                    rotation={0}
                    lineCap="round"
                  >
                    {(percentage: number) => (
                      <View style={{ alignItems: 'center', maxWidth: scoreVisualSize - 24 }}>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={{ fontSize: fs(hasPlantedCrop ? 32 : 48), fontWeight: '800', color: colors.text, textAlign: 'center' }}
                        >
                          {healthInfo.available ? Math.round(percentage) : '--'}
                        </Text>
                        <Text style={{ fontSize: fs(12), color: colors.mutedText, textAlign: 'center' }}>
                          {healthInfo.available ? t('out of 100', 'mula sa 100') : t('No index yet', 'Wala pang index')}
                        </Text>
                      </View>
                    )}
                  </AnimatedCircularProgress>
                  <Text style={{ marginTop: 12, fontSize: fs(13), fontWeight: '700', color: colors.subText, textAlign: 'center' }}>
                    {t('Sensor condition', 'Kondisyon ng sensor')}
                  </Text>
                </View>

                {zoneObj?.current_crop && (
                  <TouchableOpacity
                    style={{ width: '50%', flexGrow: 0, flexShrink: 0, paddingLeft: 8, alignItems: 'center' }}
                    activeOpacity={0.7}
                    onPress={() => {
                      lightHaptic();
                      setSelectedCrop(zoneObj.current_crop ?? null);
                      setPlantingDate(zoneObj.planted_on ?? '');
                      setPlantModalVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Change planted crop', 'Palitan ang pananim')}
                  >
                    <View style={{ width: scoreVisualSize, height: scoreVisualSize }}>
                      <View style={{ flex: 1, borderRadius: scoreVisualSize / 2, borderWidth: 3, borderColor: colors.primary, padding: 3, backgroundColor: colors.cardBg }}>
                        <Image
                          source={getCropImage(zoneObj.current_crop)}
                          resizeMode="cover"
                          style={{ width: '100%', height: '100%', borderRadius: scoreVisualSize / 2, backgroundColor: colors.cardBgAlt }}
                        />
                      </View>
                      <View pointerEvents="none" style={{ position: 'absolute', right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="pencil" size={15} color="#FFFFFF" />
                      </View>
                    </View>
                    <Text style={{ marginTop: 12, fontSize: fs(13), fontWeight: '700', color: colors.subText, textAlign: 'center', textTransform: 'capitalize' }}>
                      {zoneObj.current_crop.replace(/_/g, ' ')}
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: fs(11), fontWeight: '600', color: colors.greenText, textAlign: 'center' }}>
                      {t('Tap to change', 'Pindutin para palitan')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {!hasPlantedCrop && (
                <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: fs(15), fontWeight: '700', color: scoreColor, textAlign: 'center' }}>
                    {!healthInfo.available ? t('Waiting for complete readings', 'Hinihintay ang kumpletong datos') : healthInfo.needsAttention ? t('Some readings need attention', 'May datos na dapat suriin') : t('Readings are within reference bands', 'Nasa saklaw ang mga datos')}
                  </Text>
                  <Text style={{ fontSize: fs(13), lineHeight: fs(19), color: colors.subText, textAlign: 'center' }}>
                    {t('No crop planted in this zone yet. This provisional index summarizes the available sensor conditions.', 'Wala pang pananim sa sonang ito. Pansamantalang buod ito ng kondisyon mula sa mga sensor.')}
                  </Text>
                  <Text style={{ fontSize: fs(12), color: colors.mutedText, textAlign: 'center' }}>
                    {healthInfo.completeness} {t('valid readings', 'wastong datos')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      lightHaptic();
                      setSelectedCrop(null);
                      setPlantingDate('');
                      setPlantModalVisible(true);
                    }}
                    disabled={!activeZoneId}
                    accessibilityRole="button"
                    style={{ marginTop: 4, minHeight: 44, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.primary, opacity: activeZoneId ? 1 : 0.5 }}
                  >
                    <Text style={{ fontSize: fs(13), fontWeight: '700', color: 'white', textAlign: 'center' }}>
                      {t('Set planted crop', 'Itakda ang pananim')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ================================================= */}
            {/* CROP DETAILS - ONLY WHEN A CROP IS SELECTED */}
            {/* ================================================= */}

            {zoneObj?.current_crop && (
              <>
              <View
                className="mt-5 rounded-2xl border p-4"
                style={{
                  backgroundColor: colors.cardBgAlt,
                  borderColor: colors.border,
                }}
              >
                {/* Header */}
                <View className="flex-row items-center mb-3">
                  <View
                    className="h-9 w-9 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: colors.cardBg,
                    }}
                  >
                    <Ionicons
                      name="leaf-outline"
                      size={19}
                      color={colors.primary}
                    />
                  </View>

                  <View className="ml-3 flex-1">
                    <Text
                      style={{
                        fontSize: fs(15),
                        fontWeight: '800',
                        color: colors.text,
                      }}
                    >
                      {t('Crop Details', 'Detalye ng Pananim')}
                    </Text>

                    <Text
                      style={{
                        fontSize: fs(11),
                        color: colors.mutedText,
                        marginTop: 2,
                      }}
                    >
                      {t(
                        'Information about the selected crop',
                        'Impormasyon tungkol sa napiling pananim'
                      )}
                    </Text>
                  </View>
                </View>

                {/* Crop name */}
                <TouchableOpacity

                  onPress={() => {
                    lightHaptic();
                    setSelectedCrop(zoneObj?.current_crop ?? null);
                    setPlantingDate(zoneObj?.planted_on ?? '');
                    setPlantModalVisible(true);
                  }}
                  className="flex-row justify-between items-center border-t py-1.5 my-1"
                  style={{ borderColor: colors.border }}
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'Set planted crop for this zone',
                    'Itakda ang itinanim na pananim para sa sonang ito'
                  )}
                >
                  <Ionicons
                    name="leaf-outline"
                    size={19}
                    color={colors.primary}
                  />
                  <Text

                    className="flex-1 text-md font-semibold ml-1"
                    numberOfLines={1}
                    style={{
                      color: colors.subText,
                      fontSize: fs(14), // Adjust the font size to your desired style
                    }}
                  >

                    {t('Planted crop', 'Itinanim na pananim')}
                  </Text>

                  <View className="flex-row items-center">
                    <Text
                      className="ml-3 text-sm font-bold capitalize"
                      numberOfLines={1}
                      style={{
                        color: zoneObj?.current_crop
                          ? colors.greenText
                          : colors.mutedText,
                      }}
                    >
                      {zoneObj?.current_crop
                        ? zoneObj.current_crop.replace('_', ' ')
                        : t('Not set', 'Wala pa')}
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={colors.mutedText}
                      style={{ marginLeft: 4 }}
                    />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedCrop(zoneObj.current_crop);
                    setPlantingDate(zoneObj.planted_on ?? '');
                    setPlantModalVisible(true);
                  }}
                  style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}
                >
                  <Text style={{ color: colors.subText, fontSize: fs(13) }}>{t('Planted on (tap to edit)', 'Petsa ng pagtatanim (pindutin para baguhin)')}</Text>
                  <Text style={{ color: colors.text, fontWeight: '700', marginTop: 4 }}>{zoneObj.planted_on ?? t('Not recorded', 'Wala pang petsa')}</Text>
                </TouchableOpacity>

                {/* Soil type */}
                <View
                  className="flex-row items-center justify-between py-2.5 border-t"
                  style={{ borderColor: colors.border }}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="earth-outline"
                      size={17}
                      color={colors.primary}
                    />
                    <Text
                      className="ml-2"
                      style={{
                        fontSize: fs(13),
                        fontWeight: '600',
                        color: colors.subText,
                      }}
                    >
                      {t('Soil Type', 'Uri ng Lupa')}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: fs(13),
                      fontWeight: '800',
                      color: colors.text,
                    }}
                  >
                    {zoneObj.soil_type}
                  </Text>
                </View>

                {/* Health score */}
                <View
                  className="flex-row items-center justify-between py-2.5 border-t"
                  style={{ borderColor: colors.border }}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="analytics-outline"
                      size={17}
                      color={colors.primary}
                    />
                    <Text
                      className="ml-2"
                      style={{
                        fontSize: fs(13),
                        fontWeight: '600',
                        color: colors.subText,
                      }}
                    >
                      {t('Sensor index', 'Sensor index')}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: fs(13),
                      fontWeight: '800',
                      color:
                        !healthInfo.available ? colors.mutedText : healthInfo.needsAttention ? '#EAB308' : healthInfo.score >= 80
                          ? colors.greenText
                          : healthInfo.score >= 60
                            ? '#EAB308'
                            : '#DC2626',
                    }}
                  >
                    {healthInfo.available ? `${Math.round(healthInfo.score)}/100` : '--'}
                  </Text>
                </View>

                {/* Current moisture */}
                <View
                  className="flex-row items-center justify-between py-2.5 border-t"
                  style={{ borderColor: colors.border }}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="water-outline"
                      size={17}
                      color={colors.primary}
                    />
                    <Text
                      className="ml-2"
                      style={{
                        fontSize: fs(13),
                        fontWeight: '600',
                        color: colors.subText,
                      }}
                    >
                      {t('Soil Moisture', 'Halumigmig ng Lupa')}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: fs(13),
                      fontWeight: '800',
                      color: colors.text,
                    }}
                  >
                    {getSensorValue('soil_moisture', '--')}%
                  </Text>
                </View>

                {/* pH */}
                <View
                  className="flex-row items-center justify-between py-2.5 border-t"
                  style={{ borderColor: colors.border }}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="flask-outline"
                      size={17}
                      color={colors.primary}
                    />
                    <Text
                      className="ml-2"
                      style={{
                        fontSize: fs(13),
                        fontWeight: '600',
                        color: colors.subText,
                      }}
                    >
                      {t('Soil pH', 'pH ng Lupa')}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: fs(13),
                      fontWeight: '800',
                      color: colors.text,
                    }}
                  >
                    {getSensorValue('ph', '--')}
                  </Text>
                </View>
              </View>
              <DailyCropTips zoneId={zoneObj.id} crop={zoneObj.current_crop} plantedOn={zoneObj.planted_on} soilType={zoneObj.soil_type} />
              </>
            )}
          </View>
        </View>

        <View className="mt-6">
          <SectionHeader
            title={t('Needs attention', 'Kailangang bigyan pansin')}
            subtitle={alerts.length ? t('These conditions may need action today.', 'Maaaring kailangan ng aksyon ang mga kondisyong ito ngayon.') : t('Everything looks good today.', 'Maayos ang lahat ngayon.')}
          />
          {alerts.length > 0 ? (
            <View className="rounded-2xl border p-4" style={{ backgroundColor: '#FFF8E8', borderColor: '#F5D79B' }}>
              <View className="flex-row items-start">
                <Ionicons name="warning" size={22} color="#A16207" />
                <View className="ml-3 flex-1">
                  <Text style={{ fontSize: fs(15), fontWeight: '800', color: '#7C4A03' }}>{alerts[0].field}</Text>
                  <Text className="mt-1" style={{ fontSize: fs(13), lineHeight: 19, color: '#7C4A03' }}>{t(alerts[0].message, alerts[0].messageTl)}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="flex-row items-center rounded-2xl border p-4" style={{ backgroundColor: colors.cardBg, borderColor: colors.cardBorder }}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Text className="ml-3 flex-1" style={{ fontSize: fs(14), color: colors.subText }}>
                {t('Your latest readings are within their recommended ranges.', 'Ang inyong huling readings ay nasa inirerekomendang antas.')}
              </Text>
            </View>
          )}
        </View>

        {/* Live Sensor Readings */}
        <View className="mt-6 flex-row items-end justify-between">
          <View className="flex-1"><SectionHeader title={t('Soil conditions', 'Kondisyon ng lupa')} subtitle={t('Latest sensor readings', 'Pinakabagong sensor readings')} /></View>
          <TouchableOpacity
            onPress={handleExport}
            disabled={isExporting}
            accessibilityRole="button"
            accessibilityLabel={t('Export sensor readings as PDF', 'I-export ang mga basa ng sensor bilang PDF')}
            className="mb-3 flex-row items-center rounded-xl px-3 py-2"
            style={{ backgroundColor: colors.cardBgAlt, opacity: isExporting ? 0.55 : 1 }}
          >
            <Ionicons name="download-outline" size={18} color={colors.primaryDark} />
            <Text className="ml-1 font-bold" style={{ color: colors.primaryDark }}>
              {isExporting ? t('Exporting...', 'Ini-export...') : t('Export PDF', 'I-export ang PDF')}
            </Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row flex-wrap justify-between gap-y-3 py-2">
          <SensorCard
            colors={colors}
            fontScale={fontScale}
            icon="water-outline"
            label={t('Soil Moisture', 'Halumigmig ng Lupa')}
            value={`${getSensorValue('soil_moisture', '--')}%`}
            opt={`${OPTIMAL_RANGES.soil_moisture.min}-${OPTIMAL_RANGES.soil_moisture.max}%`}
            progress={getProgressValue(getSensorValue('soil_moisture', '0'), 100)}
          />
          <SensorCard
            colors={colors}
            fontScale={fontScale}
            icon="thermometer-outline"
            label={t('Soil Temperature', 'Temperatura ng Lupa')}
            value={`${getSensorValue('soil_temperature', '--')}°C`}
            opt={`${OPTIMAL_RANGES.soil_temperature.min}-${OPTIMAL_RANGES.soil_temperature.max}°C`}
            progress={getProgressValue(getSensorValue('soil_temperature', '0'), 50)}
          />
          <SensorCard
            colors={colors}
            fontScale={fontScale}
            icon="analytics-outline"
            label={t('Soil pH', 'Antas ng pH')}
            value={`${getSensorValue('ph', '--')}`}
            opt={`${OPTIMAL_RANGES.ph.min}-${OPTIMAL_RANGES.ph.max}`}
            progress={getProgressValue(getSensorValue('ph', '0'), 14)}
          />
          <SensorCard
            colors={colors}
            fontScale={fontScale}
            icon="flash-outline"
            label={t('Nitrogen', 'Nitrogen')}
            value={`${getSensorValue('nitrogen', '--')} ppm`}
            opt={`${OPTIMAL_RANGES.nitrogen.min}-${OPTIMAL_RANGES.nitrogen.max} ppm`}
            progress={getProgressValue(getSensorValue('nitrogen', '0'), 100)}
          />
          <SensorCard
            colors={colors}
            fontScale={fontScale}
            icon="flower-outline"
            label={t('Phosphorus', 'Phosphorus')}
            value={`${getSensorValue('phosphorus', '--')} ppm`}
            opt={`${OPTIMAL_RANGES.phosphorus.min}-${OPTIMAL_RANGES.phosphorus.max} ppm`}
            progress={getProgressValue(getSensorValue('phosphorus', '0'), 100)}
          />
          <SensorCard
            colors={colors}
            fontScale={fontScale}
            icon="medical-outline"
            label={t('Potassium', 'Potassium')}
            value={`${getSensorValue('potassium', '--')} ppm`}
            opt={`${OPTIMAL_RANGES.potassium.min}-${OPTIMAL_RANGES.potassium.max} ppm`}
            progress={getProgressValue(getSensorValue('potassium', '0'), 300)}
          />
        </View>
      </View>

      {/* Notifications are available from the header bell. */}
      {false && <View>
        <View className="my-2 flex-row items-center justify-between">
          <Text style={{ fontSize: fs(18), fontWeight: 'bold', color: colors.greenText }}>
            {t('URGENT NOTIFICATIONS', 'APURADONG NOTIFIKASYON')}
          </Text>
          {totalAlerts > 0 && (
            <View className="bg-red-500 rounded-full px-2 py-0.5">
              <Text className="text-white text-xs font-bold">{totalAlerts}</Text>
            </View>
          )}
        </View>

        {alerts.length === 0 ? (
          <View
            className="border rounded-2xl p-4"
            style={{ borderColor: colors.border, backgroundColor: colors.cardBg }}
          >
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <Text className="ml-2 font-medium" style={{ color: colors.text }}>
                {t('No alerts — all sensors within optimal range', 'Walang alerto — lahat ng sensor ay nasa optimal na antas')}
              </Text>
            </View>
          </View>
        ) : (
          alerts.map((alert, index) => (
            <Urgent_Card
              key={index}
              field={t(alert.field, alert.fieldTl)}
              message={t(alert.message, alert.messageTl)}
              date={t(alert.date, alert.dateTl)}
              severity={alert.severity}
            />
          ))
        )}
      </View>}

      {/* Soil Health Detail Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            flex: 1,
            padding: 20,
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.cardBg,
              borderRadius: 20,
              padding: 24,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                mediumHaptic();
                setModalVisibility(false);
              }}
              style={{ alignSelf: 'flex-end' }}
              accessibilityRole="button"
              accessibilityLabel={t('Close', 'Isara')}
            >
              <Ionicons name="close-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
            <View className="flex-row items-center mb-4 mt-2">
              <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.cardBgAlt }}>
                <Ionicons name="leaf-outline" size={20} color={colors.primary} />
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: 'bold',
                }}
              >
                {t('Sensor index details', 'Detalye ng sensor index')}
              </Text>
            </View>

            {healthInfo.breakdown.map((item, index) => (
              <View key={index} className="mt-4">
                <View className="flex-row justify-between mb-1">
                  <Text style={{ color: colors.subText, fontSize: 13 }}>{item.label}</Text>
                  <Text
                    style={{
                      color: item.score >= 75 ? colors.primary : item.score >= 50 ? '#EAB308' : '#DC2626',
                      fontWeight: 'bold',
                      fontSize: 13,
                    }}
                  >
                    {item.available ? `${Math.round(item.score)}/${item.max}` : t('Unavailable', 'Walang datos')}
                  </Text>
                </View>
                <Progress.Bar
                  progress={item.score / item.max}
                  height={8}
                  color={item.score >= 80 ? colors.primary : item.score >= 60 ? '#EAB308' : item.score >= 40 ? '#F97316' : '#DC2626'}
                  unfilledColor={colors.progressTrack}
                  borderWidth={0}
                  width={null}
                  borderRadius={4}
                />
              </View>
            ))}

            <View className="mt-6 pt-4" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text className="font-bold text-center text-lg" style={{ color: colors.text }}>
                {t('Overall Score', 'Kabuuang Skor')}: {healthInfo.available ? `${healthInfo.score}/100` : '--'}
              </Text>
              <Text className="text-center text-sm mt-1" style={{ color: colors.subText }}>
                {t(
                  healthInfo.interpretation?.en || 'Your soil condition is being evaluated based on 6 key parameters.',
                  healthInfo.interpretation?.tl || 'Ang kondisyon ng iyong lupa ay sinusuri batay sa 6 na pangunahing parameter.'
                )}
              </Text>
              <Text className="text-center text-xs mt-2" style={{ color: colors.greenText }}>
                {t('Score based on N, P, K, pH, temperature & humidity', 'Skor batay sa N, P, K, pH, temperatura at halumigmig')}
              </Text>
              <Text className="text-center text-xs" style={{ color: colors.greenText }}>
                {t('Provisional reference bands; crop and sensor calibration required', 'Pansamantalang saklaw; kailangan ng batayan para sa pananim at sensor')}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Zone Modal */}
      <Modal visible={addZoneModalVisible} transparent animationType="fade">
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            flex: 1,
            padding: 20,
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: colors.cardBg,
              borderRadius: 20,
              padding: 24,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                mediumHaptic();
                setAddZoneModalVisible(false);
              }}
              style={{ alignSelf: 'flex-end' }}
              accessibilityRole="button"
              accessibilityLabel={t('Close', 'Isara')}
            >
              <Ionicons name="close-circle" size={28} color={colors.primary} />
            </TouchableOpacity>
            <View className="flex-row items-center mb-4 mt-2">
              <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.cardBgAlt }}>
                <Ionicons name="add-circle" size={20} color={colors.primary} />
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: 'bold',
                }}
              >
                {t('Add New Zone', 'Magdagdag na Bagong Zona')}
              </Text>
            </View>

            <View className="mt-4">
              <Text style={{ color: colors.subText, fontSize: 14 }}>{t('Zone Name (English)', 'Pangalan ng Zona (Ingles)')}</Text>
              <TextInput
                placeholder={t('Enter zone name in English', 'Ilagay ang pangalan ng zona sa Ingles')}
                value={newZoneNameEn}
                onChangeText={text => setNewZoneNameEn(text)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                }}
              />
            </View>

            <View className="mt-4">
              <Text style={{ color: colors.subText, fontSize: 14 }}>{t('Zone Name (Tagalog)', 'Pangalan ng Zona (Tagalog)')}</Text>
              <TextInput
                placeholder={t('Enter zone name in Tagalog', 'Ilagay ang pangalan ng zona sa Tagalog')}
                value={newZoneNameTl}
                onChangeText={text => setNewZoneNameTl(text)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                }}
              />
            </View>

            <View className="mt-4">
              <Text style={{ color: colors.subText, fontSize: 14 }}>
                {t('Soil Type', 'Uri ng Lupa')}
              </Text>
              <Text style={{ color: colors.mutedText, fontSize: 12, marginTop: 2, marginBottom: 8 }}>
                {t(
                  'Crop and fertilizer suggestions will only consider crops suited to this soil type.',
                  'Ang mga irerekomendang pananim at pataba ay sasaklaw lang sa mga akma sa uri ng lupang ito.'
                )}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SOIL_TYPES.map((soilType) => (
                  <TouchableOpacity
                    key={soilType}
                    onPress={() => {
                      lightHaptic();
                      setSelectedSoilType(soilType);
                    }}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: selectedSoilType === soilType ? colors.primary : colors.border,
                      backgroundColor: selectedSoilType === soilType ? colors.primary : colors.cardBgAlt,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={soilType}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: selectedSoilType === soilType ? 'white' : colors.text,
                      }}
                    >
                      {soilType}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              onPress={async () => {
                if (
                  newZoneNameEn.trim() === '' ||
                  newZoneNameTl.trim() === '' ||
                  !selectedSoilType
                ) {
                  warningHaptic();
                  return;
                }

                mediumHaptic();
                setSavingZone(true);

                try {
                  const newZone = await createZone(
                    newZoneNameEn.trim(),
                    newZoneNameTl.trim(),
                    selectedSoilType,
                  );

                  if (!newZone) {
                    Alert.alert(
                      t('Could not save zone', 'Hindi ma-save ang sona'),
                      t('Please check your connection and try again.', 'Suriin ang koneksyon at subukan muli.'),
                    );
                    return;
                  }

                  await setActiveZoneId(newZone.id);

                  setNewZoneNameEn('');
                  setNewZoneNameTl('');
                  setSelectedSoilType(null);
                  setAddZoneModalVisible(false);
                } finally {
                  setSavingZone(false);
                }
              }}
              disabled={savingZone}
              className="mt-6 rounded-xl py-3 px-8"
              style={{ backgroundColor: colors.primary, opacity: savingZone ? 0.6 : 1 }}
            >
              <Text className="font-bold text-center" style={{ color: '#F0FDF4' }}>
                {savingZone ? t('Saving...', 'Sine-save...') : t('Save', 'I-save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Planted Plant Modal */}
      <Modal visible={plantModalVisible} transparent animationType="fade">
        <View
          style={{
            backgroundColor: 'rgba(0,0,0,0.5)',
            flex: 1,
            padding: 20,
            justifyContent: 'center',
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 24 }}
            style={{
              backgroundColor: colors.cardBg,
              borderRadius: 20,
              maxHeight: '80%',
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                mediumHaptic();
                setPlantModalVisible(false);
              }}
              style={{ alignSelf: 'flex-end' }}
              accessibilityRole="button"
              accessibilityLabel={t('Close', 'Isara')}
            >
              <Ionicons name="close-circle" size={28} color={colors.primary} />
            </TouchableOpacity>

            <View className="flex-row items-center mb-4 mt-2">
              <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.cardBgAlt }}>
                <Ionicons name="leaf" size={20} color={colors.primary} />
              </View>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold' }}>
                {t('Add Planted Plant', 'Magdagdag ng Itinanim na Pananim')}
              </Text>
            </View>

            <Text style={{ color: colors.mutedText, fontSize: 12, marginBottom: 12 }}>
              {t(
                `Select what's currently planted in ${zoneObj?.name_en ?? 'this zone'}.`,
                `Piliin ang kasalukuyang itinanim sa ${zoneObj?.name_tl ?? 'sonang ito'}.`
              )}
            </Text>

            <PlantingDatePicker value={plantingDate} onChange={setPlantingDate} />
            <ScrollView style={{ maxHeight: 220 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {PHILIPPINE_CROPS.map((crop) => (
                  <TouchableOpacity
                    key={crop}
                    onPress={() => {
                      lightHaptic();
                      setSelectedCrop(crop);
                    }}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: selectedCrop === crop ? colors.primary : colors.border,
                      backgroundColor: selectedCrop === crop ? colors.primary : colors.cardBgAlt,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={crop}
                  >
                    <Text
                      className="capitalize"
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: selectedCrop === crop ? 'white' : colors.text,
                      }}
                    >
                      {crop.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                if (!selectedCrop || !activeZoneId || !validPlantingDate(plantingDate)) {
                  warningHaptic();
                  return;
                }

                const saveCrop = async () => {
                  mediumHaptic();
                  setSavingCrop(true);

                  try {
                    const success = await setPlantedCrop(activeZoneId, selectedCrop, plantingDate);

                    if (!success) {
                      Alert.alert(
                        t('Could not save', 'Hindi ma-save'),
                        t('Please check your connection and try again.', 'Suriin ang koneksyon at subukan muli.')
                      );
                      return;
                    }

                    setPlantModalVisible(false);
                  } finally {
                    setSavingCrop(false);
                  }
                };

                if (zoneObj?.current_crop && zoneObj.current_crop !== selectedCrop) {
                  warningHaptic();
                  const previousCrop = zoneObj.current_crop.replace(/_/g, ' ');
                  const nextCrop = selectedCrop.replace(/_/g, ' ');
                  Alert.alert(
                    t('Change planted crop?', 'Palitan ang pananim?'),
                    t(
                      `This will replace ${previousCrop} with ${nextCrop} in this zone and save the selected planting date. Daily care tips will update for the new crop. Continue?`,
                      `Papalitan ang ${previousCrop} ng ${nextCrop} sa sonang ito at ise-save ang napiling petsa ng pagtatanim. Magbabago ang pang-araw-araw na payo para sa bagong pananim. Magpatuloy?`
                    ),
                    [
                      { text: t('Cancel', 'Kanselahin'), style: 'cancel' },
                      { text: t('Change crop', 'Palitan ang pananim'), onPress: () => { void saveCrop(); } },
                    ]
                  );
                  return;
                }

                void saveCrop();
              }}
              disabled={savingCrop || !selectedCrop || !validPlantingDate(plantingDate)}
              className="mt-4 rounded-xl py-3 px-8"
              style={{ backgroundColor: colors.primary, opacity: savingCrop || !selectedCrop || !validPlantingDate(plantingDate) ? 0.6 : 1 }}
            >
              <Text className="font-bold text-center" style={{ color: '#F0FDF4' }}>
                {savingCrop ? t('Saving...', 'Sine-save...') : t('Save', 'I-save')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

    </ScrollView>
  );
}

function SensorCard({
  colors,
  fontScale,
  icon,
  label,
  value,
  opt,
  progress,
}: {
  colors: ReturnType<typeof useThemeColors>;
  fontScale: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  opt: string;
  progress: number;
}) {
  const sf = (size: number) => Math.round(size * fontScale);
  return (
    <View
      className="mb-1 rounded-2xl border p-4"
      style={{
        width: '48.5%',
        minHeight: 158,
        backgroundColor: colors.sensorCardBg,
        borderColor: colors.sensorCardBorder,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      }}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}, provisional reference: ${opt}`}
    >
      <View className="flex flex-col items-center justify-center">
        <View className="h-10 w-10 rounded-full items-center justify-center mb-2" style={{ backgroundColor: colors.cardBgAlt }}>
          <Ionicons name={icon} size={19} color={colors.primary} />
        </View>
        <Text numberOfLines={1} style={{ fontSize: sf(12), fontWeight: '600', textAlign: 'center', color: colors.subText }}>
          {label}
        </Text>
      </View>
      <View className="py-2">
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontSize: sf(21), fontWeight: 'bold', color: colors.text }}
        >
          {value}
        </Text>
      </View>
      <View className="mt-1">
        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: sf(11), fontWeight: '700', color: colors.greenText }}>Ideal: {opt}</Text>
          <Text style={{ fontSize: sf(10), fontWeight: '700', color: colors.subText }}>{Math.round(progress * 100)}%</Text>
        </View>
        <Progress.Bar
          progress={progress}
          height={7}
          color={colors.primary}
          unfilledColor={colors.isDarkMode ? '#1A3522' : '#E5E7EB'}
          borderWidth={0}
          width={null}
          borderRadius={4}
          style={{ marginTop: 6 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({});
