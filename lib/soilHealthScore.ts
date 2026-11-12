interface SensorRecord {
  nitrogen?: number | string | null;
  phosphorus?: number | string | null;
  potassium?: number | string | null;
  ph?: number | string | null;
  soil_temperature?: number | string | null;
  soil_moisture?: number | string | null;
}

interface FactorScore {
  key: string;
  label: string;
  labelTl: string;
  value: number | null;
  unit: string;
  optimalMin: number;
  optimalMax: number;
  score: number | null;
  status: 'optimal' | 'low' | 'high' | 'missing' | 'invalid';
}

interface HealthScoreResult {
  overall: number | null;
  validCount: number;
  totalCount: number;
  needsAttention: boolean;
  factors: FactorScore[];
  interpretation: { en: string; tl: string };
}

/** Provisional app reference bands, not validated agronomic limits.
 * NPK require sensor/laboratory calibration and crop-specific interpretation.
 * pH reference: https://www.nrcs.usda.gov/sites/default/files/2022-11/pH%20-%20Soil%20Health%20Guide_0.pdf
 * Soil moisture and temperature use provisional bands pending calibration.
 */
export const SENSOR_REFERENCE_RANGES: Record<'nitrogen' | 'phosphorus' | 'potassium' | 'ph' | 'soil_temperature' | 'soil_moisture', { min: number; max: number; unit: string }> = {
  nitrogen:      { min: 20,  max: 100, unit: 'mg/kg' },  // Provisional
  phosphorus:    { min: 15,  max: 80,  unit: 'mg/kg' },  // Provisional
  potassium:     { min: 15,  max: 55,  unit: 'mg/kg' },  // Provisional
  ph:            { min: 6, max: 7.5, unit: '' },       // Slightly acidic to neutral
  soil_temperature: { min: 18, max: 30, unit: '°C' },     // Provisional
  soil_moisture:      { min: 60,  max: 85,  unit: '%' },      // Provisional
};

// These falloff distances are UI heuristics, not toxicity thresholds.
const TOLERANCE_MULTIPLIERS: Record<string, number> = {
  nitrogen: 1.5, phosphorus: 1.5, potassium: 1.5,
  ph: 2, soil_temperature: 1.5, soil_moisture: 1.3,
};

export function parseSensorNumber(value: unknown): number | null {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function computeFactorScore(value: number, min: number, max: number, multiplier: number): number {
  // Distance outside the reference band; values inside [min, max] have distance 0.
  const distance = Math.max(min - value, value - max, 0);
  // Falloff distance = half the band width × the factor's tolerance multiplier.
  // At this distance outside either boundary, the score reaches 0.
  const tolerance = (max - min) / 2 * multiplier;
  // Score = clamp(100 × (1 - distance / tolerance), 0, 100).
  // In-band readings score 100; scores decrease linearly outside the band.
  return Math.max(0, Math.min(100, 100 * (1 - distance / tolerance)));
}

/** Equal-weight mean of six soil factors; incomplete records have no overall score. */
export function computeSoilHealthScore(
  record: SensorRecord,
  referenceRanges: Partial<typeof SENSOR_REFERENCE_RANGES> = {}
): HealthScoreResult {
  const factors: FactorScore[] = [];

  // Define which fields to check and their labels
  const fieldConfigs = [
    { key: 'nitrogen', label: 'Nitrogen (N)', labelTl: 'Nitrogen (N)' },
    { key: 'phosphorus', label: 'Phosphorus (P)', labelTl: 'Posporus (P)' },
    { key: 'potassium', label: 'Potassium (K)', labelTl: 'Potasyo (K)' },
    { key: 'ph', label: 'Soil pH', labelTl: 'Antas ng pH' },
    { key: 'soil_temperature', label: 'Temperature', labelTl: 'Temperatura' },
    { key: 'soil_moisture', label: 'Soil Moisture', labelTl: 'Halumigmig' },
  ] as const;

  for (const config of fieldConfigs) {
    const range = referenceRanges[config.key] ?? SENSOR_REFERENCE_RANGES[config.key];
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max) ||
        range.min >= range.max || !Number.isFinite(range.max - range.min)) {
      throw new RangeError(`Invalid reference range for ${config.key}: expected finite min < max.`);
    }

    const raw = record[config.key as keyof SensorRecord];
    const value = parseSensorNumber(raw);
    const missing = raw == null || (typeof raw === 'string' && raw.trim() === '');
    const invalid = value === null ||
      (config.key === 'ph' && (value < 0 || value > 14)) ||
      (config.key === 'soil_moisture' && (value < 0 || value > 100)) ||
      (['nitrogen', 'phosphorus', 'potassium'].includes(config.key) && value < 0);
    const status: FactorScore['status'] = missing ? 'missing' : invalid ? 'invalid' :
      value! < range.min ? 'low' : value! > range.max ? 'high' : 'optimal';
    const score = missing || invalid ? null : computeFactorScore(value!, range.min, range.max, TOLERANCE_MULTIPLIERS[config.key]);

    factors.push({
      key: config.key,
      label: config.label,
      labelTl: config.labelTl,
      value,
      unit: range.unit,
      optimalMin: range.min,
      optimalMax: range.max,
      score,
      status,
    });
  }

  const validCount = factors.filter(f => f.score !== null).length;
  const totalCount = factors.length;
  // Overall = round((N + P + K + pH + temperature + moisture scores) / 6).
  // Each factor has equal weight. Missing or invalid readings withhold the index
  // rather than being treated as zero or omitted from the average.
  const overall = validCount === totalCount
    ? Math.round(factors.reduce((sum, f) => sum + f.score!, 0) / totalCount)
    : null;
  const issues = factors.filter(f => f.status === 'low' || f.status === 'high');
  const needsAttention = issues.length > 0 || validCount !== totalCount;
  const interpretation = {
    en: `${validCount}/${totalCount} readings available. ${overall === null ? 'Index unavailable until all readings are valid. ' : ''}${issues.length ? 'Check: ' + issues.map(f => f.label + ' (' + f.status + ')').join(', ') + '. ' : ''}Provisional reference bands; not a soil-health percentage or planting recommendation. All six soil readings are equally weighted; soil moisture and temperature bands require calibration.`,
    tl: `${validCount}/${totalCount} wastong pagbasa. ${overall === null ? 'Hindi makukuwenta ang index habang hindi kumpleto ang wastong datos. ' : ''}${issues.length ? 'Suriin: ' + issues.map(f => f.labelTl).join(', ') + '. ' : ''}Pansamantalang batayan lamang; hindi porsiyento ng kalusugan ng lupa o rekomendasyon sa pagtatanim. Pantay ang bigat ng anim na pagbasa ng lupa; kailangan pang i-calibrate ang batayan ng moisture at temperatura.`,
  };
  return { overall, factors, validCount, totalCount, needsAttention, interpretation };
}

export function computeOverallScore(record: SensorRecord): number | null {
  return computeSoilHealthScore(record).overall;
}

/*
 * Formula summary
 * 1. Distance = max(min - value, value - max, 0).
 * 2. Tolerance = ((max - min) / 2) × multiplier.
 * 3. Factor score = clamp(100 × (1 - distance / tolerance), 0, 100).
 * 4. Overall index = rounded average of all six factor scores.
 *
 * Values within their reference band score 100. Scores decrease linearly
 * outside the band and reach 0 when distance equals or exceeds tolerance.
 * All six soil readings must be valid; otherwise, the overall index is null.
 * This is a provisional sensor condition index, not a soil-health percentage.
 */
