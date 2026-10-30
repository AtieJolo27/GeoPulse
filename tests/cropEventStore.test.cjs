const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../lib/cropEventStore.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { createCropEventStore } = context.exports;
function setup() {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  const db = { rows: [], available: false, error: null, from() {
    let op = 'select', rows, changes, options;
    const filters = [];
    const query = {
      select() { return query; }, eq(key, value) { filters.push([key, value]); return query; }, order() { return query; },
      upsert(input, config) { op = 'upsert'; rows = input; options = config; return query; },
      update(input) { op = 'update'; changes = input; return query; }, delete() { op = 'delete'; return query; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          if (db.error) return { data: null, error: db.error };
          if (!db.available) return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.crop_events' in the schema cache" } };
          const matches = row => filters.every(([key, value]) => row[key] === value);
          if (op === 'upsert') for (const row of rows) {
            const index = db.rows.findIndex(item => ['user_id', 'zone_id', 'crop', 'planted_on', 'kind', 'event_date'].every(key => row[key] === item[key]));
            if (index < 0) db.rows.push({ id: `cloud-${db.rows.length}`, completed: false, ...row });
            else if (!options.ignoreDuplicates) db.rows[index] = { ...db.rows[index], ...row };
          }
          if (op === 'update') db.rows = db.rows.map(row => matches(row) ? { ...row, ...changes } : row);
          if (op === 'delete') db.rows = db.rows.filter(row => !matches(row));
          return { error: null, data: db.rows.filter(matches) };
        }).then(resolve, reject);
      },
    };
    return query;
  } };
  return { db, storage, store: createCropEventStore(db, storage, 'farmer', 1) };
}
const input = { user_id: 'farmer', zone_id: 1, crop: 'Rice', planted_on: '2026-10-01', kind: 'harvest', event_date: '2027-01-15', notify_at: '2027-01-15T00:00:00.000Z', source: 'manual' };
test('missing migration supports persistent local calendar CRUD', async () => {
  const { db, storage, store } = setup();
  const saved = await store.save([input], null);
  assert.equal(saved.deviceOnly, true);
  assert.equal(saved.events.length, 1);
  const reopened = createCropEventStore(db, storage, 'farmer', 1);
  const completed = await reopened.complete((await reopened.load()).events[0]);
  assert.equal(completed.events[0].completed, true);
  const edited = await reopened.save([{ ...input, event_date: '2027-01-16' }], completed.events[0]);
  assert.equal(edited.events[0].event_date, '2027-01-16');
  assert.equal((await reopened.remove(edited.events[0])).events.length, 0);
});
test('local dates sync once after the table becomes available', async () => {
  const { db, store } = setup();
  const saved = await store.save([input, input], null);
  assert.equal(saved.events.length, 1);
  await store.complete(saved.events[0]);
  db.available = true;
  const synced = await store.load();
  assert.equal(synced.deviceOnly, false);
  assert.equal(synced.events.length, 1);
  assert.equal(synced.events[0].completed, true);
  assert.match(synced.events[0].id, /^cloud-/);
  await store.load();
  assert.equal(db.rows.length, 1);
});
test('local dates stay scoped by account and zone', async () => {
  const { db, storage, store } = setup();
  await store.save([input], null);
  assert.equal((await createCropEventStore(db, storage, 'another', 1).load()).events.length, 0);
  assert.equal((await createCropEventStore(db, storage, 'farmer', 2).load()).events.length, 0);
  await assert.rejects(store.save([{ ...input, user_id: 'another' }], null), /different account/);
});
test('authorization and connectivity failures are surfaced rather than saved locally', async () => {
  const { db, store } = setup();
  db.error = { code: '42501', message: 'Permission denied' };
  await assert.rejects(store.save([input], null), /Permission denied/);
  db.error = null;
  assert.equal((await store.load()).events.length, 0);
});
