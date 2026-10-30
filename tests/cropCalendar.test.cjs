const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(name) {
  const context = { exports: {}, require: () => load('plantingDate') };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../lib/${name}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}
const { validCalendarDate, parseCropSchedule, reminderTime } = load('cropCalendar');
test('calendar accepts future dates but rejects impossible and malformed dates', () => {
  assert.equal(validCalendarDate('2028-02-29'), true);
  for (const value of ['2027-02-29', '2026-13-01', '2026-2-03', '', null]) assert.equal(validCalendarDate(value), false);
});
test('validates AI schedules and removes duplicate fertilizer dates', () => {
  const value = { harvest_date: '2027-02-01', fertilizer_dates: ['2026-11-01', '2026-11-01'], explanation: 'Variety affects maturity.' };
  assert.equal(parseCropSchedule(JSON.stringify(value), '2026-10-01').fertilizer_dates.length, 1);
  for (const change of [
    { harvest_date: '2026-09-01' }, { harvest_date: '2035-01-01' },
    { fertilizer_dates: ['2026-09-01'] }, { fertilizer_dates: ['2027-03-01'] },
    { fertilizer_dates: [null] }, { explanation: '' },
  ]) assert.throws(() => parseCropSchedule(JSON.stringify({ ...value, ...change }), '2026-10-01'));
});
test('reminder stores local 8 a.m. as an absolute instant', () => {
  const date = new Date(reminderTime('2027-01-15'));
  assert.equal(date.getHours(), 8);
  assert.equal(date.getDate(), 15);
  assert.throws(() => reminderTime('2027-02-30'));
});
