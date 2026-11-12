// User-provided soil-type reference bands; sensor VWC calibration is required.
export type SoilBand = { min: number; max: number; unit: string; lowBelow?: number; highAbove?: number; excessiveAbove?: number; risk?: string };
const names = ['nitrogen', 'phosphorus', 'potassium', 'soil_moisture', 'soil_temperature', 'ph'] as const;
const values: Record<string, number[][]> = {
  Sand: [[10,25],[10,20],[95,115],[10,15],[15,25],[6,7]],
  'Sandy Loam': [[10,25],[10,20],[130,155],[18,22],[15,25],[6,7]],
  Loam: [[10,25],[15,30],[155,190],[23,27],[15,25],[6,7]],
  'Clay Loam': [[10,25],[15,30],[190,225],[28,32],[15,25],[6,7.5]],
  Clay: [[10,25],[15,35],[225,250],[35,40],[15,25],[6,7.5]],
  'Volcanic Loam': [[10,25],[15,35],[200,225],[22,28],[15,25],[5.5,6.5]],
};
export const SOIL_TYPE_OPTIONS = Object.keys(values);
export function getSoilTypeRanges(soilType?: string | null): Record<typeof names[number], SoilBand> | null {
  const normalized = soilType?.trim().toLowerCase();
  const name = normalized === 'sandy' ? 'Sand' : SOIL_TYPE_OPTIONS.find(key => key.toLowerCase() === normalized);
  if (!name) return null;
  const moistureLimits: Record<string, [number, number]> = { Sand: [8,20], 'Sandy Loam': [12,28], Loam: [15,32], 'Clay Loam': [20,38], Clay: [25,45], 'Volcanic Loam': [15,33] };
  return Object.fromEntries(names.map((key, index) => {
    const [min, max] = values[name][index];
    let lowBelow = min, highAbove = max;
    if (key === 'soil_moisture') [lowBelow, highAbove] = moistureLimits[name];
    if (key === 'soil_temperature') [lowBelow, highAbove] = [10,30];
    if (key === 'ph') [lowBelow, highAbove] = name === 'Volcanic Loam' ? [5,7] : ['Clay', 'Clay Loam'].includes(name) ? [5.5,8] : [5.5,7.5];
    const excessiveAbove = key === 'nitrogen' ? 40 : key === 'phosphorus' ? 50 : key === 'potassium' ? 350 : undefined;
    const risk = key === 'nitrogen' ? 'Excessive / leaching risk' : key === 'phosphorus' ? 'Excessive / runoff risk' : key === 'potassium' ? 'Excessive / luxury consumption' : key === 'soil_moisture' && name === 'Clay' ? 'Waterlogged threshold' : undefined;
    return [key, { min, max, lowBelow, highAbove, excessiveAbove, risk, unit: key === 'soil_moisture' ? 'VWC %' : key === 'soil_temperature' ? 'C' : key === 'ph' ? '' : 'ppm' }];
  })) as Record<typeof names[number], SoilBand>;
}
export type SoilLevel = 'low' | 'medium' | 'high' | 'below_optimum' | 'above_optimum' | 'unavailable';
export function classifySoilValue(raw: unknown, band: SoilBand): { level: SoilLevel; risk?: string } {
  if (raw == null || (typeof raw === 'string' && !raw.trim()) || !['number','string'].includes(typeof raw)) return { level: 'unavailable' };
  const value = Number(raw);
  if (!Number.isFinite(value) || (band.unit !== 'C' && value < 0) || (band.unit === 'VWC %' && value > 100) || (band.unit === '' && value > 14)) return { level: 'unavailable' };
  const level = value < (band.lowBelow ?? band.min) ? 'low' : value > (band.highAbove ?? band.max) ? 'high' : value < band.min ? 'below_optimum' : value > band.max ? 'above_optimum' : 'medium';
  return { level, risk: (band.excessiveAbove !== undefined && value > band.excessiveAbove) || (band.unit === 'VWC %' && level === 'high') ? band.risk : undefined };
}
