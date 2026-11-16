import Papa from 'papaparse';

export interface CropMoistureRange {
  crop: string;
  soilType: string;
  min: number;
  max: number;
  source: string;
  wateringGuide: string;
  sourceTitle: string;
  sourceUrl: string;
}
const normalize = (value: string) => value.trim().toLowerCase().replace(/[ _-]+/g, ' ');
const soilKey = (value: string) => normalize(value) === 'sand' ? 'sandy' : normalize(value);

export function parseCropMoisture(content: string): CropMoistureRange[] {
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: 'greedy', transformHeader: value => value.trim(), transform: value => value.trim() });
  if (parsed.errors.length) throw new Error('Invalid crop moisture dataset');
  for (const key of ['crop', 'soil_type', 'soil_moisture_min_pct', 'soil_moisture_max_pct']) {
    if (!parsed.meta.fields?.includes(key)) throw new Error(`Missing moisture column: ${key}`);
  }
  const ranges = new Map<string, CropMoistureRange>();
  for (const row of parsed.data) {
    const min = row.soil_moisture_min_pct === '' ? NaN : Number(row.soil_moisture_min_pct);
    const max = row.soil_moisture_max_pct === '' ? NaN : Number(row.soil_moisture_max_pct);
    if (!row.crop || !row.soil_type || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) throw new Error('Invalid crop moisture range');
    const key = `${normalize(row.crop)}:${soilKey(row.soil_type)}`;
    const previous = ranges.get(key);
    if (previous && (previous.min !== min || previous.max !== max)) throw new Error(`Conflicting moisture ranges for ${row.crop} / ${row.soil_type}`);
    if (!previous) ranges.set(key, { crop: row.crop, soilType: row.soil_type, min, max, source: row.moisture_source ?? '', wateringGuide: row.watering_guide ?? '', sourceTitle: row.guidance_source_title ?? '', sourceUrl: row.guidance_source_url ?? '' });
  }
  return [...ranges.values()];
}

export function findCropMoisture(ranges: CropMoistureRange[], crop?: string | null, soilType?: string | null): CropMoistureRange | null {
  if (!crop || !soilType) return null;
  return ranges.find(range => normalize(range.crop) === normalize(crop) && soilKey(range.soilType) === soilKey(soilType)) ?? null;
}

export function classifyCropMoisture(value: number | null, range: CropMoistureRange | null): 'low' | 'within' | 'high' | 'unavailable' {
  if (value === null || !Number.isFinite(value) || value < 0 || value > 100 || !range) return 'unavailable';
  return value < range.min ? 'low' : value > range.max ? 'high' : 'within';
}
