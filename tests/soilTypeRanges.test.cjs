const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/soilTypeRanges.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { getSoilTypeRanges: ranges, SOIL_TYPE_OPTIONS } = context.exports;
test('all six soil profiles match the supplied nutrient and moisture bands', () => {
  const expected = [[10,25,10,20,95,115,10,15,6,7],[10,25,10,20,130,155,18,22,6,7],[10,25,15,30,155,190,23,27,6,7],[10,25,15,30,190,225,28,32,6,7.5],[10,25,15,35,225,250,35,40,6,7.5],[10,25,15,35,200,225,22,28,5.5,6.5]];
  SOIL_TYPE_OPTIONS.forEach((name, i) => {
    const profile = ranges(name);
    assert.deepEqual(['nitrogen','phosphorus','potassium','soil_moisture','ph'].flatMap(key => [profile[key].min,profile[key].max]), expected[i]);
    assert.equal(profile.soil_temperature.min,15);
    assert.equal(profile.soil_temperature.max,25);
  });
});
test('legacy Sandy maps to Sand; unsupported profiles remain explicit', () => {
  assert.equal(ranges('Sandy').potassium.min,95);
  assert.equal(ranges(' clay ').nitrogen.min,10);
  assert.equal(ranges('Silty Clay Loam'),null);
  assert.equal(ranges(null),null);
});

test('classification respects strict thresholds, optimum gaps, and excessive cutoffs', () => {
  const classify = context.exports.classifySoilValue;
  const loam = ranges('Loam');
  assert.equal(classify(10, loam.nitrogen).level,'medium');
  assert.equal(classify(25, loam.nitrogen).level,'medium');
  assert.equal(classify(26, loam.nitrogen).level,'high');
  assert.equal(classify(40, loam.nitrogen).risk,undefined);
  assert.ok(classify(41, loam.nitrogen).risk);
  assert.equal(classify(15, loam.soil_moisture).level,'below_optimum');
  assert.equal(classify(23, loam.soil_moisture).level,'medium');
  assert.equal(classify(32, loam.soil_moisture).level,'above_optimum');
  assert.equal(classify(33, loam.soil_moisture).level,'high');
  assert.equal(classify(10, loam.soil_temperature).level,'below_optimum');
  assert.equal(classify(30, loam.soil_temperature).level,'above_optimum');
  assert.ok(classify(46, ranges('Clay').soil_moisture).risk);
  assert.equal(classify(null,loam.nitrogen).level,'unavailable');
});
