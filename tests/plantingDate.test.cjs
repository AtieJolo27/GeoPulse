const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/plantingDate.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { validPlantingDate, daysSincePlanting } = context.exports;
test('accepts historical planting and rejects future or impossible dates', () => {
  assert.equal(validPlantingDate('2024-02-29', '2026-09-28'), true);
  for (const date of ['', '2025-02-29', '2026-02-31', '2026-09-29', '2026-9-1']) {
    assert.equal(validPlantingDate(date, '2026-09-28'), false);
  }
});
test('counts calendar days including leap days and daylight saving changes', () => {
  assert.equal(daysSincePlanting('2026-09-28', '2026-09-28'), 0);
  assert.equal(daysSincePlanting('2024-02-28', '2024-03-01'), 2);
  assert.equal(daysSincePlanting('2026-03-07', '2026-03-09'), 2);
  assert.equal(daysSincePlanting('2026-09-29', '2026-09-28'), null);
});
