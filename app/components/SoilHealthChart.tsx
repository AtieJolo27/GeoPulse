import { getSoilHistory, SoilHistoryRow } from '@/lib/getHistory';
import { computeOverallScore } from '@/lib/soilHealthScore';
import { useApp } from '@/app/lib/AppContext';
import { useThemeColors } from '@/app/lib/useThemeColors';
import React, { useEffect, useState } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Svg, Rect, Text as SvgText } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;

type TooltipInfo = {
  x: number;
  y: number;
  value: number;
  label: string;
  date: string;
} | null;

function computeHealthScore(row: SoilHistoryRow): number {
  return computeOverallScore(row);
}

function getHealthColor(score: number): string {
  if (score >= 80) return '#16A34A';
  if (score >= 60) return '#EAB308';
  if (score >= 40) return '#F97316';
  return '#DC2626';
}

function getHealthLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

export default function SoilHealthChart() {
  const { t, isDarkMode, fontScale } = useApp();
  const colors = useThemeColors();
  const fs = (size: number) => Math.round(size * fontScale);
  const [history, setHistory] = useState<SoilHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipInfo>(null);

  useEffect(() => {
    (async () => {
      const data = await getSoilHistory(30);
      setHistory(data);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View className="p-5">
        <Text style={{ fontSize: fs(14), color: colors.mutedText }}>{t('Loading health history...', 'Naglo-load ng kasaysayan ng kalusugan...')}</Text>
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

  const healthScores = history.map((row) => computeHealthScore(row));
  const latestScore = healthScores[healthScores.length - 1];

  const labelStep = Math.max(1, Math.ceil(history.length / 6));
  const labels = history.map((row, i) =>
    i % labelStep === 0
      ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : ''
  );

  const handleDataPointClick = (data: { index: number; value: number; x: number; y: number }) => {
    const index = data.index;
    if (index < 0 || index >= history.length) return;
    const row = history[index];
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
      label: getHealthLabel(data.value),
      date: dateStr,
    });
  };

  return (
    <View className="p-3">
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{ fontWeight: 'bold', fontSize: fs(18), color: colors.text }}>
          {t('Soil Health Score', 'Iskor ng Kalusugan ng Lupa')}
        </Text>
        <View className="flex-row items-center" style={{ backgroundColor: colors.cardBgAlt, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
          <View className="w-3 h-3 rounded-full mr-1.5" style={{ backgroundColor: getHealthColor(latestScore) }} />
          <Text style={{ fontWeight: 'bold', fontSize: fs(14), color: getHealthColor(latestScore) }}>
            {latestScore}% - {t(getHealthLabel(latestScore), getHealthLabel(latestScore))}
          </Text>
        </View>
      </View>
      <View className="flex-row justify-center mb-3 flex-wrap" style={{ backgroundColor: colors.cardBgAlt, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 12, padding: 8 }}>
        <View className="flex-row items-center mr-3 mb-1">
          <View className="w-2.5 h-2.5 rounded-full mr-1" style={{ backgroundColor: '#16A34A' }} />
          <Text style={{ fontSize: fs(11), color: colors.subText }}>{t('Excellent', 'Napakahusay')} (80+)</Text>
        </View>
        <View className="flex-row items-center mr-3 mb-1">
          <View className="w-2.5 h-2.5 rounded-full mr-1" style={{ backgroundColor: '#EAB308' }} />
          <Text style={{ fontSize: fs(11), color: colors.subText }}>{t('Good', 'Mabuti')} (60-79)</Text>
        </View>
        <View className="flex-row items-center mr-3 mb-1">
          <View className="w-2.5 h-2.5 rounded-full mr-1" style={{ backgroundColor: '#F97316' }} />
          <Text style={{ fontSize: fs(11), color: colors.subText }}>{t('Fair', 'Katamtaman')} (40-59)</Text>
        </View>
        <View className="flex-row items-center mb-1">
          <View className="w-2.5 h-2.5 rounded-full mr-1" style={{ backgroundColor: '#DC2626' }} />
          <Text style={{ fontSize: fs(11), color: colors.subText }}>{t('Poor', 'Mahina')} (below 40)</Text>
        </View>
      </View>
      <View>
        <LineChart
          data={{
            labels,
            datasets: [{ data: healthScores }],
          }}
          width={screenWidth - 40}
          height={220}
          yAxisSuffix="%"
          yAxisInterval={1}
          fromZero={true}
          onDataPointClick={handleDataPointClick}
          chartConfig={{
            backgroundColor: colors.chartBg,
            backgroundGradientFrom: colors.chartBg,
            backgroundGradientTo: colors.chartBg,
            decimalPlaces: 0,
            color: (opacity = 1) => isDarkMode ? `rgba(74, 222, 128, ${opacity})` : `rgba(22, 163, 74, ${opacity})`,
            labelColor: () => colors.chartLabel,
            propsForDots: { r: '4', strokeWidth: '2', stroke: isDarkMode ? '#4ADE80' : '#16A34A' },
            propsForBackgroundLines: { strokeDasharray: '4', stroke: colors.chartGrid },
            propsForVerticalLabels: { fontSize: 10 },
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
              width: screenWidth - 40,
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
              fill={getHealthColor(tooltip.value)}
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
              {tooltip.value}%
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
      </View>
      <TouchableOpacity onPress={() => setTooltip(null)} className="mt-1 self-center">
        <Text style={{ fontSize: fs(11), color: colors.mutedText }}>
          {tooltip ? t('Tap to dismiss', 'I-tap para alisin') : `${t('Last', 'Huling')} ${healthScores.length} ${t('readings', 'pagbasa')}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
