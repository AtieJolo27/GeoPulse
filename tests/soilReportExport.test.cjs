const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function moduleAt(file, require, extras = {}) {
  const context = { exports: {}, require, setTimeout, clearTimeout, ...extras };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
test('web prints report HTML in its own document without native PDF/sharing', async () => {
  let frame, printed = false;
  const api = moduleAt('lib/exportSensorReadings.ts', name => name === 'react-native' ? { Platform: { OS: 'web' } } : {}, {
    document: { createElement: () => (frame = { style: {}, remove() {}, contentWindow: { addEventListener(_, callback) { this.cleanup = callback; }, focus() {}, print() { printed = true; this.cleanup(); } } }), body: { appendChild: item => item.onload() } },
  });
  await api.exportSensorReadingsPdf([{ nitrogen: 0, phosphorus: null }], '<Zone>');
  assert.equal(printed, true);
  assert.match(frame.srcdoc, /&lt;Zone&gt;/);
  assert.match(frame.srcdoc, /N \(mg\/kg\)/);
  assert.match(frame.srcdoc, /<td>0<\/td>/);
  assert.ok(!frame.srcdoc.includes('<Zone>'));
});
test('native export creates and shares a real PDF', async () => {
  let shared;
  const api = moduleAt('lib/exportSensorReadings.ts', name => name === 'react-native' ? { Platform: { OS: 'ios' } } : name === 'expo-print' ? { printToFileAsync: async () => ({ uri: 'file:///report.pdf' }) } : name === 'expo-sharing' ? { isAvailableAsync: async () => true, shareAsync: async uri => { shared = uri; } } : {});
  await api.exportSensorReadingsPdf([{ nitrogen: 10 }]);
  assert.equal(shared, 'file:///report.pdf');
  await assert.rejects(api.exportSensorReadingsPdf([]), /no sensor readings/);
});
test('soil history export queries newest zone sensor readings and surfaces database errors', async () => {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'order']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.limit = async () => ({ data: null, error: { message: 'offline' } });
  const api = moduleAt('app/lib/exportSoilPDF.ts', name => name.includes('supabase') ? { supabase: { from: table => { calls.push(['from', table]); return query; } } } : {});
  await assert.rejects(api.exportSoilHistoryPDF(null), /Select a zone/);
  await assert.rejects(api.exportSoilHistoryPDF(18), /offline/);
  assert.ok(calls.some(c => c[0] === 'from' && c[1] === 'sensor_readings'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'zone_id' && c[2] === 18));
  assert.ok(calls.some(c => c[0] === 'order' && c[1] === 'created_at' && c[2].ascending === false));
});

test('Android saves returned PDF bytes even when the print cache URI is unreadable', async () => {
  let written;
  const api = moduleAt('lib/exportSensorReadings.ts', name => name === 'react-native' ? { Platform: { OS: 'android' } } : name === 'expo-print' ? {
    printToFileAsync: async options => {
      assert.equal(options.base64, true);
      return { uri: 'file:///unreadable/Print/report.pdf', base64: 'JVBERi0xLjQ=' };
    },
  } : name === 'expo-file-system/legacy' ? {
    EncodingType: { Base64: 'base64' },
    readAsStringAsync: () => { throw new Error('Cache file is not readable'); },
    StorageAccessFramework: {
      getUriForDirectoryInRoot: () => 'content://downloads',
      requestDirectoryPermissionsAsync: async () => ({ granted: true, directoryUri: 'content://downloads' }),
      createFileAsync: async () => 'content://downloads/report.pdf',
      writeAsStringAsync: async (uri, bytes, options) => { written = { uri, bytes, options }; },
    },
  } : {});
  await api.exportSensorReadingsPdf([{ nitrogen: 10 }]);
  assert.equal(written.uri, 'content://downloads/report.pdf');
  assert.equal(written.bytes, 'JVBERi0xLjQ=');
  assert.equal(written.options.encoding, 'base64');
});
const scoreApi = moduleAt('lib/soilHealthScore.ts', () => ({}));
test('dashboard report includes the current snapshot, crop, dates, health and alerts without tips/history', () => {
  const api = moduleAt('lib/exportDashboardReport.ts', name => name.includes('soilTypeRanges') ? moduleAt('lib/soilTypeRanges.ts', () => ({})) : name.includes('soilHealthScore') ? scoreApi : { escapeHtml: value => String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;') });
  const html = api.dashboardReportHtml({
    zone: { id: 18, name_en: 'Banana zone', soil_type: 'Loam', current_crop: 'banana', planted_on: '2026-10-01' },
    reading: { id: 9, zone_id: 18, created_at: '2026-10-12T04:00:00Z', nitrogen: 20, phosphorus: 30, potassium: 170, ph: 6.5, air_temperature: 25, humidity: 70, soil_moisture: 72, soil_temperature: 25 },
    alerts: [{ field: 'Test parameter', severity: 'high', message: '<Check sensor>' }],
  }, new Date('2026-10-12T06:00:00Z'));
  for (const value of ['Banana zone', 'Loam', 'banana', '2026-10-01', 'Report date:', 'Sensor reading date:', '83/100', '72', 'Test parameter', '&lt;Check sensor&gt;']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('DailyCropTips'));
  assert.ok(!html.includes('Nutrient History'));
});
test('dashboard export rejects a reading from a different zone', async () => {
  const api = moduleAt('lib/exportDashboardReport.ts', name => name.includes('soilTypeRanges') ? moduleAt('lib/soilTypeRanges.ts', () => ({})) : name.includes('soilHealthScore') ? scoreApi : {});
  await assert.rejects(api.exportDashboardReport({ zone: { id: 18, name_en: 'Zone' }, reading: { zone_id: 10 }, alerts: [] }), /does not belong/);
});
