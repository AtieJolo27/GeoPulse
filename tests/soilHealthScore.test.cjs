const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/soilHealthScore.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const score = context.exports.computeSoilHealthScore;
const base = { nitrogen: 40, phosphorus: 30, potassium: 35, ph: 6.5, air_temperature: 25, humidity: 70 };
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
  assert.equal(score({ ...base, humidity: 101 }).overall, null);
  assert.equal(score({ ...base, ph: 15 }).overall, null);
  assert.equal(score({ ...base, air_temperature: 0 }).validCount, 6);
});
