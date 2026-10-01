const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('lib/zoneRecommendations.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function setup(reading, status = 404) {
  const requests = [];
  const filters = [];
  const query = {};
  for (const method of ['select', 'order', 'limit', 'abortSignal']) query[method] = () => query;
  query.eq = (...args) => { filters.push(args); return query; };
  query.maybeSingle = async () => ({ data: reading, error: null });
  const context = { exports: {}, require: () => ({ supabase: { from: () => query } }), fetch: async (url, options) => {
    requests.push({ url, options });
    return requests.length === 1
      ? { status, ok: status === 200, json: async () => ({ zone_id: 7, detail: 'Service error' }) }
      : { ok: true, json: async () => ({ crop: { best_crop: 'corn', recommendations: [] }, fertilizer: { recommendations: [] } }) };
  }};
  vm.runInNewContext(code, context);
  return { load: context.exports.loadZoneRecommendations, requests, filters };
}
const reading = { id: 12, zone_id: 7, soil_moisture: 30, soil_temperature: 25, air_temperature: 28, humidity: 60, ph: 6, nitrogen: 10, phosphorus: 20, potassium: 30 };

test('404 fallback submits only the selected zone measurements and labels predicted crop', async () => {
  const { load, requests, filters } = setup(reading);
  const result = await load('https://example.test/', 7, new AbortController().signal);
  assert.deepEqual(filters, [['zone_id', 7]]);
  assert.equal(requests[1].url, 'https://example.test/predict');
  assert.equal(JSON.parse(requests[1].options.body).nitrogen, 10);
  assert.equal(result.reading.id, 12);
  assert.equal(result.fertilizer_crop_source, 'legacy-predicted');
});
test('empty zone never predicts another zone data', async () => {
  const { load, requests } = setup(null);
  assert.equal((await load('https://example.test', 7, new AbortController().signal)).reading, null);
  assert.equal(requests.length, 1);
});
test('invalid latest data does not reach prediction endpoint', async () => {
  const { load, requests } = setup({ ...reading, ph: null });
  await assert.rejects(load('https://example.test', 7, new AbortController().signal), /valid ph/);
  assert.equal(requests.length, 1);
});
test('server errors do not trigger compatibility fallback', async () => {
  const { load, requests } = setup(reading, 500);
  await assert.rejects(load('https://example.test', 7, new AbortController().signal), /Service error/);
  assert.equal(requests.length, 1);
});
