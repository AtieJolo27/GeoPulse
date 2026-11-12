import { classifySoilValue, getSoilTypeRanges } from './soilTypeRanges';
import { escapeHtml, exportReportHtml } from './exportSensorReadings';
import { computeSoilHealthScore, parseSensorNumber } from './soilHealthScore';

type Snapshot = {
  zone: { id: number; name_en: string; name_tl?: string; current_crop?: string | null; planted_on?: string | null; soil_type?: string | null };
  reading: Record<string, unknown>;
  alerts: { field: string; message: string; severity: string }[];
  dataWarning?: string | null;
};

export function dashboardReportHtml({ zone, reading, alerts, dataWarning }: Snapshot, generatedAt = new Date()): string {
  const ranges = getSoilTypeRanges(zone.soil_type);
  const health = computeSoilHealthScore(reading, ranges ?? {});
  const formatDate = (value: unknown) => {
    if (!value) return 'Not recorded';
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
  };
  const parameterRows = [
    ['soil_moisture', 'Soil moisture', '%', '70-75'],
    ['soil_temperature', 'Soil temperature', 'C', '20-30'],
    ['ph', 'Soil pH', '', '6-7.5'],
    ['nitrogen', 'Nitrogen (N)', 'mg/kg (ppm)', '20-100'],
    ['phosphorus', 'Phosphorus (P)', 'mg/kg (ppm)', '15-80'],
    ['potassium', 'Potassium (K)', 'mg/kg (ppm)', '15-55'],
    ['air_temperature', 'Air temperature', 'C', '18-30'],
    ['humidity', 'Air humidity', '%', '60-85'],
  ].map(([key, label, unit, range]) => {
    const band = ranges?.[key as keyof typeof ranges];
    const displayedRange = band ? `${band.min}-${band.max}` : range;
    const displayedUnit = band?.unit ?? unit;
    const value = parseSensorNumber(reading[key]);
    const status = band ? classifySoilValue(reading[key], band) : undefined;
    return `<tr><td>${label}</td><td>${value === null ? 'Unavailable' : escapeHtml(value)}</td><td>${displayedUnit}</td><td>${displayedRange}</td><td>${escapeHtml(status?.level.replace(/_/g, ' ') ?? 'Not classified')}${status?.risk ? ' - ' + escapeHtml(status.risk) : ''}</td></tr>`;
  }).join('');
  const factorRows = health.factors.map(factor => `<tr><td>${escapeHtml(factor.label)}</td><td>${factor.score === null ? 'Unavailable' : factor.score.toFixed(1) + '/100'}</td><td>${escapeHtml(factor.status)}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>GeoPulse Dashboard Soil Report</title><style>
    @page { size: A4 portrait; margin: 14mm; }
    body { font-family: Arial, sans-serif; color: #1f2937; font-size: 12px; }
    h1,h2 { color: #0D5E33; } h1 { font-size: 24px; } h2 { font-size: 17px; margin-top: 22px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; } th,td { padding: 8px; border: 1px solid #d1d5db; text-align: left; }
    th { background: #edf7ef; } thead { display: table-header-group; } tr { break-inside: avoid; }
    .note { color: #4b5563; line-height: 1.5; } .warning { padding: 10px; background: #fff7ed; }
  </style></head><body>
    <h1>GeoPulse Dashboard Soil Report</h1>
    <p><strong>Report date:</strong> ${escapeHtml(generatedAt.toLocaleString())}</p>
    <p><strong>Sensor reading date:</strong> ${escapeHtml(formatDate(reading.created_at))}</p>
    <p class="note">Snapshot of the currently displayed dashboard reading. Dates use the exporting device's local time.</p>
    ${dataWarning ? `<p class="warning">Dashboard data warning: ${escapeHtml(dataWarning)}. This report may contain cached readings.</p>` : ''}
    <h2>Field and crop details</h2>
    <table><tbody>
      <tr><th>Zone</th><td>${escapeHtml(zone.name_en)} (ID ${escapeHtml(zone.id)})</td></tr>
      <tr><th>Soil type</th><td>${escapeHtml(zone.soil_type || 'Not recorded')}</td></tr>
      <tr><th>Currently planted crop</th><td>${escapeHtml(zone.current_crop?.replace(/_/g, ' ') || 'No crop planted')}</td></tr>
      <tr><th>Planting date</th><td>${escapeHtml(zone.planted_on || 'Not recorded')}</td></tr>
      <tr><th>Reading ID</th><td>${escapeHtml(reading.id ?? 'Not recorded')}</td></tr>
    </tbody></table>
    <h2>Current soil and environmental parameters</h2>
    <table><thead><tr><th>Parameter</th><th>Current value</th><th>Unit</th><th>Optimum band</th><th>Classification</th></tr></thead><tbody>${parameterRows}</tbody></table>
    <p class="note">Configured nutrient thresholds assume nitrate-N and Mehlich-3 P. Moisture assumes calibrated VWC. Texture is used as a CEC proxy for K; measured CEC is not available. Confirm matching laboratory and sensor measurement methods before interpreting these categories.</p>
    <h2>Overall soil condition</h2>
    <p><strong>Sensor condition index:</strong> ${health.overall === null ? 'Unavailable' : health.overall + '/100'} | ${health.validCount}/${health.totalCount} valid scored readings</p>
    <p><strong>Status:</strong> ${health.overall === null ? 'Incomplete data' : health.needsAttention ? 'Check readings' : 'Within reference bands'}</p>
    <table><thead><tr><th>Scored factor</th><th>Score</th><th>Status</th></tr></thead><tbody>${factorRows}</tbody></table>
    <p class="note">${escapeHtml(health.interpretation.en)}</p>
    <p class="note">Each valid factor receives 100 inside its band and decreases linearly outside it. The index is the rounded, equally weighted average of six scores. Soil moisture and soil temperature are excluded from scoring pending calibration. Reference bands are provisional app settings, not universal agronomic targets.</p>
    <h2>Dashboard alerts (${alerts.length})</h2>
    ${alerts.length ? `<table><thead><tr><th>Parameter</th><th>Severity</th><th>Message</th></tr></thead><tbody>${alerts.map(alert => `<tr><td>${escapeHtml(alert.field)}</td><td>${escapeHtml(alert.severity)}</td><td>${escapeHtml(alert.message)}</td></tr>`).join('')}</tbody></table>` : '<p>No dashboard alerts for this reading. This does not certify overall soil health.</p>'}
    <p class="note">Generated by GeoPulse from the selected zone dashboard snapshot.</p>
  </body></html>`;
}

export async function exportDashboardReport(snapshot: Snapshot): Promise<void> {
  if (snapshot.reading.zone_id == null || String(snapshot.reading.zone_id) !== String(snapshot.zone.id)) {
    throw new Error('The displayed reading does not belong to the selected zone. Refresh the dashboard and retry.');
  }
  await exportReportHtml(dashboardReportHtml(snapshot));
}
