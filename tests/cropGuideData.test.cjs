const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, require };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/cropGuideData.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, context);
const { parseCropGuides } = context.exports;

test('bundled crop guide dataset loads all 24 crops with trimmed names and usable guides', () => {
  const rows = parseCropGuides(fs.readFileSync('backend/app/machine_learning/datasets/crop_guide.csv', 'utf8'));
  assert.equal(rows.length, 24);
  assert.equal(rows[0].crop_label, 'rice');
  for (const row of rows) {
    assert.equal(row.crop_label, row.crop_label.trim());
    assert.ok(row.fertilizer_timing && row.fertilizer_method && row.watering_guide);
    assert.ok(row.guidance_source_url.startsWith('https://'));
  }
});

test('whitespace-only lines are ignored and values are trimmed', () => {
  const rows = parseCropGuides('  crop_label,watering_guide\n  rice ,  Keep moist  \n   \n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].watering_guide, 'Keep moist');
});

test('missing crop labels and malformed CSV surface a load failure', () => {
  assert.throws(() => parseCropGuides('wrong_header,watering_guide\nrice,water'), /No crop guides/);
  assert.throws(() => parseCropGuides('crop_label,watering_guide\nrice,water,extra'), /Invalid crop guide/);
});
