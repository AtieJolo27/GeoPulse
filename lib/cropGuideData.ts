import Papa from 'papaparse';

export interface CSVRow {
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

export function parseCropGuides(content: string): CSVRow[] {
  const result = Papa.parse<CSVRow>(content, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => header.trim(),
    transform: value => value.trim(),
  });
  if (result.errors.length) throw new Error('Invalid crop guide data');
  const rows = result.data.filter(item => item.crop_label);
  if (!rows.length) throw new Error('No crop guides found in the dataset');
  return rows;
}
