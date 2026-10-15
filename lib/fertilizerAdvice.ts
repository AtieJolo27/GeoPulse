const base = 'https://extension.umn.edu/agriculture/crop-production/nutrient-management-for-minnesota-crops/';
const refs = {
  nitrogen: { title: 'Fertilizer urea', publisher: 'University of Minnesota Extension', url: base + 'fertilizer-urea', supports: 'Urea supplies nitrogen (46% N).' },
  phosphorus: { title: 'Understanding phosphorus fertilizers', publisher: 'University of Minnesota Extension', url: base + 'understanding-phosphorus-fertilizers', supports: 'Describes phosphorus fertilizer composition; product grades vary.' },
  potassium: { title: 'Potassium for crop production', publisher: 'University of Minnesota Extension', url: base + 'potassium-for-crop-production', supports: 'Describes potassium fertilizer sources.' },
};
export const FERTILIZER_CATALOG = {
  urea: { name: 'Urea (Nitrogen rich fertilizer)', inDataset: true, sources: [refs.nitrogen] },
  mop: { name: 'MOP (Muriate of Potash)', inDataset: true, sources: [refs.potassium] },
  dap: { name: 'DAP (Diammonium Phosphate)', inDataset: true, sources: [refs.phosphorus] },
  npk14: { name: 'Balanced NPK (14-14-14)', inDataset: true, sources: [] },
  npk10: { name: 'Balanced NPK (10-26-26)', inDataset: true, sources: [] },
  ssp: { name: 'Single superphosphate', inDataset: false, sources: [refs.phosphorus] },
};
export type FertilizerAdvice = { assessment: string; recommendations: { id: string; name: string; reason: string; inDataset: boolean; sources: typeof refs.nitrogen[] }[] };
export function parseFertilizerAdvice(reply: string): FertilizerAdvice {
  const parsed = JSON.parse(reply);
  if (!parsed || typeof parsed.assessment !== 'string' || !parsed.assessment.trim() || parsed.assessment.length > 3000 || !Array.isArray(parsed.recommendations) || parsed.recommendations.length > 3) throw new Error('Invalid fertilizer response');
  const seen = new Set<string>();
  const recommendations = parsed.recommendations.map((row: { id: string; reason: string }) => {
    if (!row || typeof row.id !== 'string' || !Object.prototype.hasOwnProperty.call(FERTILIZER_CATALOG, row.id) || seen.has(row.id) || typeof row.reason !== 'string' || !row.reason.trim() || row.reason.length > 2000) throw new Error('Invalid fertilizer suggestion');
    seen.add(row.id);
    return { id: row.id, reason: row.reason.trim(), ...FERTILIZER_CATALOG[row.id as keyof typeof FERTILIZER_CATALOG] };
  });
  return { assessment: parsed.assessment.trim(), recommendations };
}
