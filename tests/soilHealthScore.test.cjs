const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/soilHealthScore.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const score = context.exports.computeSoilHealthScore;
const base = { nitrogen: 40, phosphorus: 30, potassium: 35, ph: 6.5, soil_temperature: 25, soil_moisture: 70 };
test('complete reference readings produce 100', () => assert.equal(score(base).overall, 100));
test('boundary falloff is continuous and monotonic', () => {
  const values = [20, 19.99, 15, 10, 0].map(nitrogen => score({ ...base, nitrogen }).factors[0].score);
  assert.ok(values[0] - values[1] < 0.1);
  values.slice(1).forEach((value, i) => assert.ok(value <= values[i]));
});
test('valid zero is counted', () => {
  const result = score({ ...base, nitrogen: 0 });
  assert.equal(result.validCount, 6);
  assert.ok(result.overall < 100);
  assert.equal(result.needsAttention, true);
});
test('missing and invalid readings withhold the index', () => {
  for (const nitrogen of [undefined, null, '', ' ', NaN, Infinity, -1, 'bad']) {
    const result = score({ ...base, nitrogen });
    assert.equal(result.overall, null);
    assert.equal(result.validCount, 5);
  }
  assert.equal(score({ ph: 6.5 }).overall, null);
  assert.equal(score({}).overall, null);
});
test('numeric strings are accepted consistently', () => assert.equal(score(Object.fromEntries(Object.entries(base).map(([k,v]) => [k,String(v)]))).overall, 100));
test('severe individual issue remains visible despite high average', () => {
  const result = score({ ...base, ph: 3 });
  assert.equal(result.overall, 83);
  assert.equal(result.needsAttention, true);
  assert.match(result.interpretation.en, /Soil pH \(low\)/);
  assert.doesNotMatch(result.interpretation.en, /ready for planting|Excellent/);
});
test('physical limits are validated, zero temperature is valid', () => {
  assert.equal(score({ ...base, soil_moisture: 101 }).overall, null);
  assert.equal(score({ ...base, soil_moisture: -1 }).overall, null);
  assert.equal(score({ ...base, ph: 15 }).overall, null);
  assert.equal(score({ ...base, soil_temperature: 0 }).validCount, 6);
});

test('air readings cannot substitute for missing soil readings', () => {
  const { soil_temperature, soil_moisture, ...nutrients } = base;
  const result = score({ ...nutrients, air_temperature: 25, humidity: 70 });
  assert.equal(result.overall, null);
  assert.equal(result.validCount, 4);
});

test('soil temperature and moisture each contribute one sixth of the index', () => {
  for (const change of [{ soil_temperature: 0 }, { soil_moisture: 0 }]) {
    const result = score({ ...base, ...change });
    assert.equal(result.overall, 83);
    assert.equal(result.needsAttention, true);
    assert.doesNotMatch(result.interpretation.en, /not scored/);
  }
});

test('custom soil profile bands determine factor scores', () => {
  const ranges = { potassium: { min: 155, max: 190, unit: 'ppm' } };
  assert.equal(score({ ...base, potassium: 170 }, ranges).overall, 100);
  assert.equal(score(base, ranges).factors[2].score, 0);
});

test('invalid custom bands are rejected instead of producing NaN or misleading scores', () => {
  for (const [min, max] of [[20, 20], [30, 20], [NaN, 100], [20, Infinity]]) {
    assert.throws(() => score(base, { nitrogen: { min, max, unit: 'mg/kg' } }), /Invalid reference range for nitrogen/);
  }
});
