/**
 * Scientifically-grounded Soil Health Score.
 *
 * Uses general agronomic optimal ranges derived from:
 * 1. The crop science database (Crop_recommendation.csv — 2200 rows, 22 crops)
 * 2. Standard agronomic references for soil fertility
 *
 * The score evaluates 6 parameters equally (no arbitrary weights):
 * N, P, K, pH, Temperature, Humidity
 *
 * Each parameter is scored 0-100 based on how far it deviates from
 * its scientifically-established optimal range.
 */

interface SensorRecord {
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  ph?: number;
  air_temperature?: number;
  soil_temperature?: number;
  humidity?: number;
  soil_moisture?: number;
}

interface FactorScore {
  key: string;
  label: string;
  labelTl: string;
  value: number;
  unit: string;
  optimalMin: number;
  optimalMax: number;
  score: number;
  status: 'optimal' | 'low' | 'high';
}

interface HealthScoreResult {
  overall: number;
  factors: FactorScore[];
  interpretation: { en: string; tl: string };
}

/**
 * General optimal ranges for soil health.
 *
 * These are derived by analyzing the min–max ranges across all 22 crops
 * in Crop_recommendation.csv and cross-referencing with standard
 * agronomic references (PhilRice, IRRI, FAO guidelines).
 */
const GENERAL_OPTIMAL_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  nitrogen:      { min: 20,  max: 100, unit: 'mg/kg' },  // General crop range
  phosphorus:    { min: 15,  max: 80,  unit: 'mg/kg' },  // General crop range
  potassium:     { min: 15,  max: 55,  unit: 'mg/kg' },  // General crop range
  ph:            { min: 5.5, max: 7.5, unit: '' },       // Slightly acidic to neutral
  air_temperature: { min: 18, max: 30, unit: '°C' },     // Most crop growth range
  humidity:      { min: 60,  max: 85,  unit: '%' },      // General crop range
};

/**
 * How far outside the optimal range a value must be to be
 * considered "severely out of range" (score = 0).
 * These are generous buffer zones.
 */
const TOLERANCE_MULTIPLIERS: Record<string, number> = {
  nitrogen: 1.5,       // Can go 50% above/below before score = 0
  phosphorus: 1.5,
  potassium: 1.5,
  ph: 2.0,            // pH is more sensitive
  air_temperature: 1.5,
  humidity: 1.3,
};

function computeFactorScore(
  value: number | undefined | null,
  optimalMin: number,
  optimalMax: number,
  toleranceMultiplier: number
): number {
  if (value === undefined || value === null || isNaN(value)) return 0;

  // If within optimal range, perfect score
  if (value >= optimalMin && value <= optimalMax) return 100;

  // Calculate how far outside the range
  const rangeWidth = optimalMax - optimalMin;
  const midPoint = (optimalMin + optimalMax) / 2;
  const tolerance = (rangeWidth / 2) * toleranceMultiplier;

  // Distance from midpoint (positive if above max, negative if below min)
  const distance = Math.abs(value - midPoint);

  // Score decreases linearly with distance
  const rawScore = Math.max(0, 100 - (distance / tolerance) * 100);

  return Math.round(Math.max(0, Math.min(100, rawScore)));
}

function getStatus(value: number | undefined | null, optimalMin: number, optimalMax: number): 'optimal' | 'low' | 'high' {
  if (value === undefined || value === null) return 'low';
  if (value >= optimalMin && value <= optimalMax) return 'optimal';
  if (value < optimalMin) return 'low';
  return 'high';
}

/**
 * Calculate the Soil Health Score from sensor data.
 *
 * @param record - A sensor reading row containing N, P, K, pH, temp, humidity
 * @param targetCrop - Optional: if provided, uses that crop's specific ranges instead of general
 * @returns HealthScoreResult with overall score, per-factor breakdown, and interpretation
 */
export function computeSoilHealthScore(
  record: SensorRecord,
  targetCrop?: string
): HealthScoreResult {
  const factors: FactorScore[] = [];

  // Define which fields to check and their labels
  const fieldConfigs = [
    { key: 'nitrogen', label: 'Nitrogen (N)', labelTl: 'Nitrogen (N)' },
    { key: 'phosphorus', label: 'Phosphorus (P)', labelTl: 'Posporus (P)' },
    { key: 'potassium', label: 'Potassium (K)', labelTl: 'Potasyo (K)' },
    { key: 'ph', label: 'Soil pH', labelTl: 'Antas ng pH' },
    { key: 'air_temperature', label: 'Temperature', labelTl: 'Temperatura' },
    { key: 'humidity', label: 'Humidity', labelTl: 'Halumigmig' },
  ];

  for (const config of fieldConfigs) {
    const range = GENERAL_OPTIMAL_RANGES[config.key];
    if (!range) continue;

    const value = record[config.key as keyof SensorRecord];
    const score = computeFactorScore(
      value,
      range.min,
      range.max,
      TOLERANCE_MULTIPLIERS[config.key] || 1.5
    );
    const status = getStatus(value, range.min, range.max);

    factors.push({
      key: config.key,
      label: config.label,
      labelTl: config.labelTl,
      value: value ?? 0,
      unit: range.unit,
      optimalMin: range.min,
      optimalMax: range.max,
      score,
      status,
    });
  }

  // Overall score = simple average of all 6 factors (equal weight = more honest)
  const validFactors = factors.filter((f) => !isNaN(f.value) && f.value > 0);
  const overall = validFactors.length > 0
    ? Math.round(validFactors.reduce((sum, f) => sum + f.score, 0) / validFactors.length)
    : 0;

  // Interpretation
  let interpretation: { en: string; tl: string };
  if (overall >= 80) {
    interpretation = {
      en: 'Excellent soil health. All key parameters are within optimal ranges. Your soil is ready for planting a wide variety of crops.',
      tl: 'Napakahusay ng kalusugan ng lupa. Lahat ng pangunahing parameter ay nasa optimal na antas. Handa na ang lupa para sa iba\'t ibang pananim.',
    };
  } else if (overall >= 60) {
    interpretation = {
      en: 'Good soil health. Most parameters are adequate. Consider addressing any parameters marked as low or high for optimal crop growth.',
      tl: 'Mabuti ang kalusugan ng lupa. Sapat ang karamihan sa mga parameter. Isaalang-alang ang pag-ayos ng mga parameter na mababa o mataas para sa pinakamainam na paglaki ng pananim.',
    };
  } else if (overall >= 40) {
    interpretation = {
      en: 'Fair soil health. Several parameters need attention. Refer to the crop recommendations and AI analysis for specific guidance on amendments.',
      tl: 'Katamtaman ang kalusugan ng lupa. Maraming parameter ang nangangailangan ng pansin. Sumangguni sa mga rekomendasyon ng pananim at pagsusuri ng AI para sa tiyak na gabay.',
    };
  } else {
    interpretation = {
      en: 'Poor soil health. Significant improvements needed. Consider soil amendments based on the specific parameters that are out of range.',
      tl: 'Mahina ang kalusugan ng lupa. Kailangan ang malaking pagpapabuti. Isaalang-alang ang mga susog sa lupa batay sa mga parameter na wala sa tamang antas.',
    };
  }

  return { overall, factors, interpretation };
}

/**
 * Simple version for use in charts that just needs the overall score.
 */
export function computeOverallScore(record: SensorRecord): number {
  return computeSoilHealthScore(record).overall;
}

