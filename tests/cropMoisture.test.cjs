const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, require };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/cropMoisture.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, context);
const { parseCropMoisture, findCropMoisture, classifyCropMoisture } = context.exports;
const ranges = parseCropMoisture(fs.readFileSync('backend/app/machine_learning/datasets/crop_recommendation_dataset_ph_full.csv', 'utf8'));

test('updated dataset deduplicates into 61 consistent crop-and-soil targets', () => {
  assert.equal(ranges.length, 61);
  for (const range of ranges) assert.ok(range.min >= 0 && range.max <= 100 && range.min <= range.max && range.source);
});

test('corn target changes with soil rather than averaging across soils', () => {
  assert.equal(findCropMoisture(ranges, 'corn', 'Loam').min, 17.9);
  assert.equal(findCropMoisture(ranges, 'corn', 'Loam').max, 25);
  assert.equal(findCropMoisture(ranges, 'corn', 'Sandy Loam').min, 16.4);
  assert.equal(findCropMoisture(ranges, 'corn', 'Sandy Loam').max, 23);
});

test('normalization handles crop names and the existing Sand soil alias', () => {
  assert.equal(findCropMoisture(ranges, ' Sweet Potato ', 'sandy_loam').min, 15.2);
  assert.equal(findCropMoisture(ranges, 'cassava', 'Sand').min, 9.4);
});

test('missing crop-soil combinations do not borrow another range', () => {
  assert.equal(findCropMoisture(ranges, 'rice', 'Loam'), null);
  assert.equal(findCropMoisture(ranges, null, 'Loam'), null);
});

test('range boundaries are inclusive and low/high guidance follows the planted crop', () => {
  const range = findCropMoisture(ranges, 'corn', 'Loam');
  assert.equal(classifyCropMoisture(17.8, range), 'low');
  assert.equal(classifyCropMoisture(17.9, range), 'within');
  assert.equal(classifyCropMoisture(25, range), 'within');
  assert.equal(classifyCropMoisture(25.1, range), 'high');
  for (const value of [null, NaN, -1, 101]) assert.equal(classifyCropMoisture(value, range), 'unavailable');
  assert.equal(classifyCropMoisture(20, null), 'unavailable');
});

test('invalid and contradictory dataset targets fail instead of silently selecting a row', () => {
  const header = 'crop,soil_type,soil_moisture_min_pct,soil_moisture_max_pct\n';
  assert.throws(() => parseCropMoisture(header + 'corn,Loam,,25'), /Invalid/);
  assert.throws(() => parseCropMoisture(header + 'corn,Loam,30,20'), /Invalid/);
  assert.throws(() => parseCropMoisture(header + 'corn,Loam,18,25\ncorn,Loam,19,25'), /Conflicting/);
  assert.throws(() => parseCropMoisture('crop,humidity\ncorn,80'), /Missing moisture column/);
});
