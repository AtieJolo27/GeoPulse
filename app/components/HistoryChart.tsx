import { getSoilHistory, SoilHistoryRow } from '@/lib/getHistory';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useWindowDimensions, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Svg, Rect, Text as SvgText } from 'react-native-svg';

type Metric = {
  key: keyof SoilHistoryRow;
  label: string;
  labelTl: string;
  unit: string;
  color: string;
};

const METRICS: Metric[] = [
  { key: 'nitrogen', label: 'Nitrogen', labelTl: 'Nitrogen', unit: 'mg/kg', color: '#16A34A' },
  { key: 'phosphorus', label: 'Phosphorus', labelTl: 'Phosphorus', unit: 'mg/kg', color: '#22C55E' },
  { key: 'potassium', label: 'Potassium', labelTl: 'Potassium', unit: 'mg/kg', color: '#0D5E33' },
  { key: 'ph', label: 'Soil pH', labelTl: 'Antas ng pH', unit: '', color: '#059669' },
  { key: 'air_temperature', label: 'Air Temp', labelTl: 'Temp ng Hangin', unit: '°C', color: '#4ADE80' },
  { key: 'soil_temperature', label: 'Soil Temp', labelTl: 'Temp ng Lupa', unit: '°C', color: '#10B981' },
  { key: 'humidity', label: 'Humidity', labelTl: 'Halumigmig', unit: '%', color: '#34D399' },
  { key: 'soil_moisture', label: 'Soil Moisture', labelTl: 'Halumigmig ng Lupa', unit: '%', color: '#6EE7B7' },
];



type TooltipInfo = {
  x: number;
  y: number;
  value: number;
  unit: string;
  label: string;
  date: string;
} | null;

export default function NutrientHistoryChart() {
  const { t, language, fontScale, activeZoneId } = useApp();
  const { width: screenWidth } = useWindowDimensions();
  const colors = useThemeColors();
  const fs = (size: number) => Math.round(size * fontScale);
  const [history, setHistory] = useState<SoilHistoryRow[]>([]);
  const [selected, setSelected] = useState<Metric>(METRICS[0]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipInfo>(null);

  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setTooltip(null);
    setError(null);
    void getSoilHistory(30, activeZoneId, true).then(data => {
      if (active) setHistory(data);
    }).catch(error => {
      if (active) { setHistory([]); setError(error instanceof Error ? error.message : 'Unable to load history.'); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // Retry intentionally reruns the focused history request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZoneId, retry]));

  if (error) return <View style={{ padding: 20, gap: 12 }}><Text style={{ color: colors.danger }}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={{ color: colors.greenText }}>{t('Retry history', 'Subukang muli')}</Text></TouchableOpacity></View>;

  if (loading) {
    return (
      <View className="p-5">
        <Text style={{ fontSize: fs(14), color: colors.mutedText }}>{t('Loading history...', 'Naglo-load ng kasaysayan...')}</Text>
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View className="p-5">
        <Text style={{ fontSize: fs(14), color: colors.mutedText }}>{t('No historical data yet.', 'Wala pang makasaysayang datos.')}</Text>
      </View>
    );
  }

  const plotted = history.filter(row => row[selected.key] != null && Number.isFinite(Number(row[selected.key])));
  const values = plotted.map((row) => Number(row[selected.key]));
  const labelStep = Math.max(1, Math.ceil(plotted.length / 6));
  const labels = plotted.map((row, i) =>
    i % labelStep === 0
      ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : ''
  );

  const handleDataPointClick = (data: { index: number; value: number; x: number; y: number }) => {
    const index = data.index;
    if (index < 0 || index >= plotted.length) return;
    const row = plotted[index];
    const dateStr = new Date(row.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    setTooltip({
      x: data.x,
      y: data.y,
      value: data.value,
      unit: selected.unit,
      label: language === 'tagalog' ? selected.labelTl : selected.label,
      date: dateStr,
    });
  };

  return (
    <View className="p-3">
      <Text style={{ fontWeight: 'bold', fontSize: fs(18), color: colors.text, marginBottom: 8 }}>
        {t('Nutrient & Soil History', 'Kasaysayan ng Nutrisyon at Lupa')}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
        {METRICS.map((metric) => (
          <TouchableOpacity
            key={metric.key}
            onPress={() => {
              setSelected(metric);
              setTooltip(null);
            }}
            className="mr-2 px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: selected.key === metric.key ? metric.color : colors.cardBgAlt,
            }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: selected.key === metric.key ? 'white' : (colors.isDarkMode ? '#86EFAC' : '#0D5E33') }}
            >
              {language === 'tagalog' ? metric.labelTl : metric.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {values.length === 0 ? <Text style={{ color: colors.subText }}>{t('No valid readings for this metric.', 'Walang wastong datos para sa sukat na ito.')}</Text> : <View>
        <LineChart
          data={{
            labels,
            datasets: [{ data: values }],
          }}
          width={Math.max(240, screenWidth - 64)}
          height={220}
          yAxisSuffix={selected.unit}
          onDataPointClick={handleDataPointClick}
          chartConfig={{
            backgroundColor: colors.chartBg,
            backgroundGradientFrom: colors.chartBg,
            backgroundGradientTo: colors.chartBg,
            decimalPlaces: 1,
            color: (opacity = 1) => selected.color,
            labelColor: () => colors.chartLabel,
            propsForDots: { r: '3', strokeWidth: '1', stroke: selected.color },
            propsForBackgroundLines: { strokeDasharray: '4', stroke: colors.chartGrid },
          }}
          bezier
          style={{ borderRadius: 16 }}
        />

        {tooltip && (
          <Svg
            style={{
              position: 'absolute',
              top: -40,
              left: 0,
              width: Math.max(240, screenWidth - 64),
              height: 280,
            }}
          >
            <Rect
              x={tooltip.x - 65}
              y={tooltip.y - 50}
              width={130}
              height={42}
              rx={8}
              ry={8}
              fill={selected.color}
              opacity={0.95}
            />
            <SvgText
              x={tooltip.x}
              y={tooltip.y - 36}
              fill="white"
              fontSize={11}
              fontWeight="bold"
              textAnchor="middle"
            >
              {tooltip.value}{tooltip.unit}
            </SvgText>
            <SvgText
              x={tooltip.x}
              y={tooltip.y - 22}
              fill="white"
              fontSize={10}
              textAnchor="middle"
            >
              {tooltip.label}
            </SvgText>
            <SvgText
              x={tooltip.x}
              y={tooltip.y - 10}
              fill="rgba(255,255,255,0.8)"
              fontSize={8}
              textAnchor="middle"
            >
              {tooltip.date}
            </SvgText>
          </Svg>
        )}
      </View>}

      <TouchableOpacity
        onPress={() => setTooltip(null)}
        className="mt-2 self-center"
      >
        <Text style={{ fontSize: fs(11), color: colors.mutedText }}>
          {tooltip ? t('Tap to dismiss', 'I-tap para alisin') : `${t('Last', 'Huling')} ${plotted.length} ${t('readings', 'pagbasa')}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
