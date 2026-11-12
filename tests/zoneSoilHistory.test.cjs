const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('soil history requires a zone and fetches its latest readings chronologically', async () => {
  const calls = [];
  const query = {};
  for (const key of ['select', 'eq', 'order']) {
    query[key] = (...args) => { calls.push([key, ...args]); return query; };
  }
  query.limit = async () => ({ data: [{ id: 3 }, { id: 2 }], error: null });
  const context = { exports: {}, console, require: () => ({ supabase: {
    from: table => { calls.push(['from', table]); return query; },
  } }) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/getHistory.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  const get = context.exports.getSoilHistory;
  assert.equal((await get(30, null)).length, 0);
  assert.equal(calls.length, 0);
  const rows = await get(2, 18);
  assert.deepEqual(calls.find(call => call[0] === 'from'), ['from', 'sensor_readings']);
  assert.deepEqual(calls.find(call => call[0] === 'eq'), ['eq', 'zone_id', 18]);
  assert.equal(calls.find(call => call[0] === 'order')[2].ascending, false);
  assert.deepEqual(Array.from(rows, row => row.id), [2, 3]);
});
