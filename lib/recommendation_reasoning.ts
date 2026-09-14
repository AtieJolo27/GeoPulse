// lib/cropReasoning.ts

interface SoilReading {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  air_temperature: number;
  humidity: number;
}

interface CropRange {
  n: [number, number];
  p: [number, number];
  k: [number, number];
  temp: [number, number];
  humidity: [number, number];
  ph: [number, number];
}

// Ranges derived directly from Crop_recommendation.csv (min–max per crop, 2200 rows, 22 crops)
const CROP_RANGES: Record<string, CropRange> = {
  apple: { n: [0, 40], p: [120, 145], k: [195, 205], temp: [21.0, 24.0], humidity: [90.0, 94.9], ph: [5.5, 6.5] },
  banana: { n: [80, 120], p: [70, 95], k: [45, 55], temp: [25.0, 29.9], humidity: [75.0, 85.0], ph: [5.5, 6.5] },
  blackgram: { n: [20, 60], p: [55, 80], k: [15, 25], temp: [25.1, 34.9], humidity: [60.1, 70.0], ph: [6.5, 7.8] },
  chickpea: { n: [20, 60], p: [55, 80], k: [75, 85], temp: [17.0, 21.0], humidity: [14.3, 20.0], ph: [6.0, 8.9] },
  coconut: { n: [0, 40], p: [5, 30], k: [25, 35], temp: [25.0, 29.9], humidity: [90.0, 100.0], ph: [5.5, 6.5] },
  coffee: { n: [80, 120], p: [15, 40], k: [25, 35], temp: [23.1, 27.9], humidity: [50.0, 69.9], ph: [6.0, 7.5] },
  cotton: { n: [100, 140], p: [35, 60], k: [15, 25], temp: [22.0, 26.0], humidity: [75.0, 84.9], ph: [5.8, 8.0] },
  grapes: { n: [0, 40], p: [120, 145], k: [195, 205], temp: [8.8, 41.9], humidity: [80.0, 84.0], ph: [5.5, 6.5] },
  jute: { n: [60, 100], p: [35, 60], k: [35, 45], temp: [23.1, 27.0], humidity: [70.9, 89.9], ph: [6.0, 7.5] },
  kidneybeans: { n: [0, 40], p: [55, 80], k: [15, 25], temp: [15.3, 24.9], humidity: [18.1, 25.0], ph: [5.5, 6.0] },
  lentil: { n: [0, 40], p: [55, 80], k: [15, 25], temp: [18.1, 29.9], humidity: [60.1, 69.9], ph: [5.9, 7.8] },
  maize: { n: [60, 100], p: [35, 60], k: [15, 25], temp: [18.0, 26.5], humidity: [55.3, 74.8], ph: [5.5, 7.0] },
  mango: { n: [0, 40], p: [15, 40], k: [25, 35], temp: [27.0, 36.0], humidity: [45.0, 55.0], ph: [4.5, 7.0] },
  mothbeans: { n: [0, 40], p: [35, 60], k: [15, 25], temp: [24.0, 32.0], humidity: [40.0, 65.0], ph: [3.5, 9.9] },
  mungbean: { n: [0, 40], p: [35, 60], k: [15, 25], temp: [27.0, 29.9], humidity: [80.0, 90.0], ph: [6.2, 7.2] },
  muskmelon: { n: [80, 120], p: [5, 30], k: [45, 55], temp: [27.0, 29.9], humidity: [90.0, 95.0], ph: [6.0, 6.8] },
  orange: { n: [0, 40], p: [5, 30], k: [5, 15], temp: [10.0, 34.9], humidity: [90.0, 95.0], ph: [6.0, 8.0] },
  papaya: { n: [31, 70], p: [46, 70], k: [45, 55], temp: [23.0, 43.7], humidity: [90.0, 94.9], ph: [6.5, 7.0] },
  pigeonpeas: { n: [0, 40], p: [55, 80], k: [15, 25], temp: [18.3, 37.0], humidity: [30.4, 69.7], ph: [4.5, 7.4] },
  pomegranate: { n: [0, 40], p: [5, 30], k: [35, 45], temp: [18.1, 25.0], humidity: [85.1, 95.0], ph: [5.6, 7.2] },
  rice: { n: [60, 99], p: [35, 60], k: [35, 45], temp: [20.0, 26.9], humidity: [80.1, 85.0], ph: [5.0, 7.9] },
  watermelon: { n: [80, 120], p: [5, 30], k: [45, 55], temp: [24.0, 27.0], humidity: [80.0, 90.0], ph: [6.0, 7.0] },
};

function inRange(value: number, range: [number, number]): boolean {
  return value >= range[0] && value <= range[1];
}

export function getCropReasoning(crop: string, reading: SoilReading): string[] {
  const range = CROP_RANGES[crop.toLowerCase()];
  if (!range) return ['No detailed profile available for this crop yet.'];

  const checks: { label: string; value: number; unit: string; range: [number, number] }[] = [
    { label: 'Nitrogen', value: reading.nitrogen, unit: 'mg/kg', range: range.n },
    { label: 'Phosphorus', value: reading.phosphorus, unit: 'mg/kg', range: range.p },
    { label: 'Potassium', value: reading.potassium, unit: 'mg/kg', range: range.k },
    { label: 'Temperature', value: reading.air_temperature, unit: '°C', range: range.temp },
    { label: 'Humidity', value: reading.humidity, unit: '%', range: range.humidity },
    { label: 'Soil pH', value: reading.ph, unit: '', range: range.ph },
  ];

  return checks.map(({ label, value, unit, range }) => {
    const ok = inRange(value, range);
    if (ok) {
      return `${label} (${value}${unit}) is within ${crop}'s ideal range of ${range[0]}–${range[1]}${unit}.`;
    }
    const direction = value < range[0] ? 'a bit low for' : 'a bit high for';
    return `${label} (${value}${unit}) is ${direction} ${crop}, whose ideal range is ${range[0]}–${range[1]}${unit}.`;
  });
}

export function getMatchSummary(crop: string, reading: SoilReading): { matched: number; total: number } {
  const range = CROP_RANGES[crop.toLowerCase()];
  if (!range) return { matched: 0, total: 6 };

  const checks = [
    inRange(reading.nitrogen, range.n),
    inRange(reading.phosphorus, range.p),
    inRange(reading.potassium, range.k),
    inRange(reading.air_temperature, range.temp),
    inRange(reading.humidity, range.humidity),
    inRange(reading.ph, range.ph),
  ];

  return { matched: checks.filter(Boolean).length, total: checks.length };
}