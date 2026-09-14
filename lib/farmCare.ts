export interface FarmReading {
  soil_moisture?: number | string | null;
  nitrogen?: number | string | null;
  phosphorus?: number | string | null;
  potassium?: number | string | null;
  ph?: number | string | null;
  air_temperature?: number | string | null;
  humidity?: number | string | null;
}

export type FarmTone = 'healthy' | 'warning' | 'urgent' | 'neutral';

export interface FarmAlert {
  tone: FarmTone;
  icon: 'sunny-outline' | 'rainy-outline' | 'water-outline' | 'partly-sunny-outline';
  titleEn: string;
  titleTl: string;
  messageEn: string;
  messageTl: string;
}

export interface NutrientTrend {
  key: 'nitrogen' | 'phosphorus' | 'potassium' | 'ph';
  label: string;
  labelTl: string;
  direction: 'up' | 'down' | 'steady' | 'unknown';
  messageEn: string;
  messageTl: string;
}

export interface FarmTask {
  id: string;
  whenEn: string;
  whenTl: string;
  titleEn: string;
  titleTl: string;
  detailEn: string;
  detailTl: string;
  icon: 'water-outline' | 'leaf-outline' | 'search-outline' | 'calendar-outline';
}

const asNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function getFieldWeatherAlert(reading: FarmReading | null): FarmAlert {
  const moisture = asNumber(reading?.soil_moisture);
  const temperature = asNumber(reading?.air_temperature);
  const humidity = asNumber(reading?.humidity);

  if (moisture !== null && moisture < 60 && temperature !== null && temperature >= 32) {
    return {
      tone: 'urgent', icon: 'sunny-outline', titleEn: 'Hot and dry field conditions', titleTl: 'Mainit at tuyong kondisyon sa bukid',
      messageEn: 'Check moisture early in the morning. Water only if the soil remains dry.',
      messageTl: 'Suriin ang moisture sa umaga. Magdilig lamang kung tuyo pa rin ang lupa.',
    };
  }
  if (moisture !== null && moisture > 75 && humidity !== null && humidity >= 80) {
    return {
      tone: 'warning', icon: 'rainy-outline', titleEn: 'Wet field conditions', titleTl: 'Basang kondisyon sa bukid',
      messageEn: 'Avoid watering today. Check drainage and inspect plants for leaf disease.',
      messageTl: 'Iwasan munang magdilig ngayon. Suriin ang drainage at dahon ng halaman.',
    };
  }
  if (temperature !== null && temperature >= 32) {
    return {
      tone: 'warning', icon: 'partly-sunny-outline', titleEn: 'Warm field conditions', titleTl: 'Mainit na kondisyon sa bukid',
      messageEn: 'Mulch exposed soil and check moisture before midday.',
      messageTl: 'Lagyan ng mulch ang nakalantad na lupa at suriin ang moisture bago magtanghali.',
    };
  }
  return {
    tone: 'healthy', icon: 'partly-sunny-outline', titleEn: 'Field conditions are stable', titleTl: 'Matatag ang kondisyon sa bukid',
    messageEn: 'Continue routine moisture checks and follow your normal watering schedule.',
    messageTl: 'Ipagpatuloy ang regular na pagsuri ng moisture at normal na iskedyul ng pagdidilig.',
  };
}

export function getNutrientTrends(readings: FarmReading[]): NutrientTrend[] {
  const metrics: Array<Pick<NutrientTrend, 'key' | 'label' | 'labelTl'>> = [
    { key: 'nitrogen', label: 'Nitrogen', labelTl: 'Nitrogen' },
    { key: 'phosphorus', label: 'Phosphorus', labelTl: 'Phosphorus' },
    { key: 'potassium', label: 'Potassium', labelTl: 'Potassium' },
    { key: 'ph', label: 'Soil pH', labelTl: 'Soil pH' },
  ];
  const recent = readings.slice(0, 7);
  const previous = readings.slice(7, 14);

  return metrics.map((metric) => {
    const recentValues = recent.map((item) => asNumber(item[metric.key])).filter((value): value is number => value !== null);
    const previousValues = previous.map((item) => asNumber(item[metric.key])).filter((value): value is number => value !== null);
    if (!recentValues.length || !previousValues.length) {
      return { ...metric, direction: 'unknown', messageEn: 'Collect more readings to see a trend.', messageTl: 'Mangolekta pa ng readings para makita ang trend.' };
    }
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const difference = average(recentValues) - average(previousValues);
    const threshold = metric.key === 'ph' ? 0.15 : Math.max(1, Math.abs(average(previousValues)) * 0.08);
    if (difference > threshold) return { ...metric, direction: 'up', messageEn: 'Higher than the previous 7 readings.', messageTl: 'Mas mataas kaysa sa nakaraang 7 readings.' };
    if (difference < -threshold) return { ...metric, direction: 'down', messageEn: 'Lower than the previous 7 readings.', messageTl: 'Mas mababa kaysa sa nakaraang 7 readings.' };
    return { ...metric, direction: 'steady', messageEn: 'Stable across the last 14 readings.', messageTl: 'Matatag sa huling 14 readings.' };
  });
}

export function buildFarmTasks(reading: FarmReading | null, date = new Date()): FarmTask[] {
  const dayKey = date.toISOString().slice(0, 10);
  const moisture = asNumber(reading?.soil_moisture);
  const nitrogen = asNumber(reading?.nitrogen);
  const tasks: FarmTask[] = [];

  if (moisture !== null && moisture < 70) {
    tasks.push({ id: `${dayKey}-moisture-check`, whenEn: 'Today', whenTl: 'Ngayon', titleEn: 'Check soil moisture before watering', titleTl: 'Suriin ang moisture bago magdilig', detailEn: 'Water in the early morning only if the soil is still dry.', detailTl: 'Magdilig sa umaga lamang kung tuyo pa rin ang lupa.', icon: 'water-outline' });
  } else {
    tasks.push({ id: `${dayKey}-field-check`, whenEn: 'Today', whenTl: 'Ngayon', titleEn: 'Inspect the field', titleTl: 'Suriin ang bukid', detailEn: 'Check leaves, drainage, and soil moisture before making changes.', detailTl: 'Suriin ang dahon, drainage, at moisture bago gumawa ng pagbabago.', icon: 'search-outline' });
  }
  if (nitrogen !== null && nitrogen < 20) {
    tasks.push({ id: `${dayKey}-compost`, whenEn: 'Tomorrow', whenTl: 'Bukas', titleEn: 'Prepare fully decomposed compost', titleTl: 'Maghanda ng ganap na nabulok na compost', detailEn: 'Use it to support soil organic matter while awaiting a local fertilizer recommendation.', detailTl: 'Gamitin ito upang masuportahan ang organic matter habang hinihintay ang lokal na rekomendasyon.', icon: 'leaf-outline' });
  } else {
    tasks.push({ id: `${dayKey}-mulch`, whenEn: 'Tomorrow', whenTl: 'Bukas', titleEn: 'Maintain soil cover', titleTl: 'Panatilihing may takip ang lupa', detailEn: 'Keep mulch or safe crop residues around plants to retain moisture.', detailTl: 'Maglagay ng mulch o ligtas na crop residues upang mapanatili ang moisture.', icon: 'leaf-outline' });
  }
  tasks.push({ id: `${dayKey}-weekly-review`, whenEn: 'This week', whenTl: 'Ngayong linggo', titleEn: 'Review your nutrient trend', titleTl: 'Suriin ang nutrient trend', detailEn: 'Compare the latest readings before deciding on fertilizer or irrigation changes.', detailTl: 'Ihambing ang pinakabagong readings bago magbago ng pataba o patubig.', icon: 'calendar-outline' });
  return tasks;
}
