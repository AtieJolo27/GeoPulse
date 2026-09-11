import { DashboardSkeleton } from '@/app/components/LoadingSkeleton';
import { SectionHeader } from '@/app/components/ui/SectionHeader';
import { StatusBadge } from '@/app/components/ui/StatusBadge';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import { computeSoilHealthScore } from '@/lib/soilHealthScore';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
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
import { CACHE_KEYS, getCache, setCache } from '../../../lib/cache';
import { exportSensorReadingsPdf } from '../../../lib/exportSensorReadins';
import { lightHaptic, mediumHaptic, warningHaptic } from '../../../lib/haptics';
import { supabase } from '../../../lib/supabaseClient';
import Urgent_Card from '../../components/UrgentCard';

const OPTIMAL_RANGES = {
  soil_moisture: { min: 70, max: 75, unit: '%' },
  soil_temperature: { min: 20, max: 30, unit: '°C' },
  ph: { min: 6.0, max: 7.5, unit: '' },
  nitrogen: { min: 20, max: 40, unit: 'ppm' },
  phosphorus: { min: 10, max: 30, unit: 'ppm' },
  potassium: { min: 100, max: 200, unit: 'ppm' },
} as const;

interface SensorReading {
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

interface Zone {
  key: string;
  labelEn: string;
  labelTl: string;
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

function computeHealthScore(record: SensorReading | null): { 
  score: number; 
  breakdown: { label: string; score: number; max: number }[]; 
  interpretation?: { en: string; tl: string } 
} {
  if (!record) return { score: 0, breakdown: [] };

  const toNumber = (value: string | number | undefined) => {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const result = computeSoilHealthScore({
    nitrogen: toNumber(record.nitrogen),
    phosphorus: toNumber(record.phosphorus),
    potassium: toNumber(record.potassium),
    ph: toNumber(record.ph),
    air_temperature: toNumber(record.air_temperature),
    soil_temperature: toNumber(record.soil_temperature),
    humidity: toNumber(record.humidity),
    soil_moisture: toNumber(record.soil_moisture),
  });

  const breakdown = result.factors.map((f) => ({
    label: `${f.label} (${f.optimalMin}-${f.optimalMax} ${f.unit})`,
    score: f.score,
    max: 100,
  }));

  return {
    score: result.overall,
    breakdown,
    interpretation: result.interpretation,
  };
}

export default function index() {
  const { t, fontScale } = useApp();
  const colors = useThemeColors();
  const fs = (size: number) => Math.round(size * fontScale);

  const [modalVisible, setModalVisibility] = useState(false);
  const [data, setData] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string>('A');
  const [zones, setZones] = useState<Zone[]>([
    { key: 'A', labelEn: 'Zone A', labelTl: 'Sona A' },
  ]);
  const [newZoneNameEn, setNewZoneNameEn] = useState('');
  const [newZoneNameTl, setNewZoneNameTl] = useState('');
  const [addZoneModalVisible, setAddZoneModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const generateNewZoneKey = useCallback((): string => {
    const len = zones.length;
    if (len < 26) {
      return String.fromCharCode(65 + len);
    }
    return `Z${len - 25}`;
  }, [zones.length]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const cached = await getCache<SensorReading[]>(CACHE_KEYS.SENSOR_READINGS);
      if (cached && cached.length > 0) {
        setData(cached);
        setLoading(false);
      }

      const { data: fetchedData, error: fetchError } = await supabase
        .from('sensor_readings')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const orderedData = fetchedData ?? [];
      setData(orderedData);

      if (orderedData.length > 0) {
        await setCache(CACHE_KEYS.SENSOR_READINGS, orderedData);
      }
    } catch (err: any) {
      console.warn('fetchData error:', err);
      setError(err.message || 'Failed to fetch sensor data');
      if (data.length === 0) {
        const cached = await getCache<SensorReading[]>(CACHE_KEYS.SENSOR_READINGS);
        if (cached) {
          setData(cached);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data.length]);

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
    return data.length > 0 ? data[0] : null;
  }, [data]);

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

  const zoneObj = zones.find(z => z.key === selectedZone);
  const zoneLabelEn = zoneObj?.labelEn ?? 'Zone';
  const zoneLabelTl = zoneObj?.labelTl ?? 'Sona';
  const totalAlerts = alerts.length;

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
              key={zone.key}
              onPress={() => {
                lightHaptic();
                setSelectedZone(zone.key);
              }}
              className="border rounded-2xl h-13 p-4"
              style={{
                width: 80,
                backgroundColor: selectedZone === zone.key ? colors.primary : colors.cardBgAlt,
                borderColor: selectedZone === zone.key ? colors.primary : colors.border,
                shadowColor: selectedZone === zone.key ? colors.primary : 'transparent',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: selectedZone === zone.key ? 0.3 : 0,
                shadowRadius: 4,
                elevation: selectedZone === zone.key ? 4 : 0,
              }}
              accessibilityRole="button"
              accessibilityLabel={t(`Select ${zone.labelEn}`, `Piliin ang ${zone.labelTl}`)}
            >
              <Text
                style={{ fontSize: fs(16), fontWeight: 'bold', textAlign: 'center', color: selectedZone === zone.key ? 'white' : colors.text }}
              >
                {t(zone.labelEn, zone.labelTl)}
              </Text>
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
        </View>

        {/* Soil Health Score */}
        <SectionHeader
          title={t('Soil health', 'Kalusugan ng lupa')}
          subtitle={t('Your field at a glance', 'Buod ng kondisyon ng inyong bukid')}
          action={<StatusBadge label={healthInfo.score >= 80 ? t('Healthy', 'Malusog') : healthInfo.score >= 60 ? t('Needs care', 'Kailangang alagaan') : t('Needs attention', 'Kailangang bigyan pansin')} tone={healthInfo.score >= 80 ? 'healthy' : healthInfo.score >= 60 ? 'warning' : 'critical'} />}
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
              accessibilityLabel={t('View soil health details', 'Tingnan ang detalye ng kalusugan ng lupa')}
            >
              <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.cardBgAlt }}>
              <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                {t('Details', 'Detalye')}
              </Text>
            </View>
          </View>
          <View className="mt-4 flex-row items-start">
            <View>
              <AnimatedCircularProgress
                size={71}
                width={5}
                fill={healthInfo.score}
                tintColor={healthInfo.score >= 80 ? '#16A34A' : healthInfo.score >= 60 ? '#EAB308' : healthInfo.score >= 40 ? '#F97316' : '#DC2626'}
                onAnimationComplete={() => {}}
                backgroundColor={colors.cardBgAlt}
              >
                {(percentage: number) => (
                  <Text
                    className="text-2xl font-bold text-center"
                    style={{ color: colors.text }}
                  >
                    {Math.round(percentage)}%
                  </Text>
                )}
              </AnimatedCircularProgress>
            </View>
            <View className="ml-4 flex-1">
              <View className="flex-row justify-between py-1.5">
                <Text className="flex-1 text-sm font-semibold" numberOfLines={1} style={{ color: colors.subText }}>
                  {t('Soil type', 'Uri ng lupa')}
                </Text>
                <Text className="ml-3 text-sm font-bold" numberOfLines={1} style={{ color: colors.greenText }}>
                  {t('Good', 'Mabuti')}
                </Text>
              </View>
              <View className="flex-row justify-between border-t py-1.5" style={{ borderColor: colors.border }}>
                <Text className="flex-1 text-sm font-semibold" numberOfLines={1} style={{ color: colors.subText }}>
                  {t('Organic matter', 'Organikong bagay')}
                </Text>
                <Text className="ml-3 text-sm font-bold" numberOfLines={1} style={{ color: colors.greenText }}>3.2</Text>
              </View>
              <View className="flex-row justify-between border-t py-1.5" style={{ borderColor: colors.border }}>
                <Text className="flex-1 text-sm font-semibold" numberOfLines={1} style={{ color: colors.subText }}>
                  {t('Texture', 'Tekstura')}
                </Text>
                <Text className="ml-3 text-sm font-bold" numberOfLines={1} style={{ color: colors.greenText }}>
                  {t('Medium', 'Katamtaman')}
                </Text>
              </View>
              <View className="flex-row justify-between border-t py-1.5" style={{ borderColor: colors.border }}>
                <Text className="flex-1 text-sm font-semibold" numberOfLines={1} style={{ color: colors.subText }}>
                  {t('Planting status', 'Katayuan ng pagtatanim')}
                </Text>
                <Text className="ml-3 text-sm font-bold" numberOfLines={1} style={{ color: colors.greenText }}>
                  {t('Ready for Planting', 'Handa na sa Pagtatanim')}
                </Text>
              </View>
            </View>
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
                {t('Soil Health Score Breakdown', 'Paghiwa-hiwalay ng Skor ng Kalusugan ng Lupa')}
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
                    {item.score}/{item.max}
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
                {t('Overall Score', 'Kabuuang Skor')}: {healthInfo.score}%
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
                {t('Each factor scored against general crop optimal ranges', 'Bawat factor ay isinama laban sa general optimal range ng pananim')}
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

            <TouchableOpacity
              onPress={() => {
                if (newZoneNameEn.trim() === '' || newZoneNameTl.trim() === '') {
                  warningHaptic();
                  return;
                }
                mediumHaptic();
                const newKey = generateNewZoneKey();
                setZones(prev => [...prev, { key: newKey, labelEn: newZoneNameEn.trim(), labelTl: newZoneNameTl.trim() }]);
                setSelectedZone(newKey);
                setNewZoneNameEn('');
                setNewZoneNameTl('');
                setAddZoneModalVisible(false);
              }}
              className="mt-6 rounded-xl py-3 px-8"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="font-bold" style={{ color: '#F0FDF4' }}>
                {t('Save', 'I-save')}
              </Text>
            </TouchableOpacity>
          </View>
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
      accessibilityLabel={`${label}: ${value}, optimal range: ${opt}`}
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
