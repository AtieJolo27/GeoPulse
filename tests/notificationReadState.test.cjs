const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const modules = new Map();
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const context = { exports: {}, localStorage: storage, require: path => load(path.replace('./', '')) };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../lib/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
    modules.set(name, context.exports);
    return context.exports;
  }
  return load('notificationReadState');
}
const reading = { id: 1, created_at: '2026-10-30T00:00:00Z', nitrogen: 0, phosphorus: 0, potassium: 0, soil_moisture: 0, soil_temperature: 50, ph: 1 };
test('opening five previews decreases six unread alerts to one; viewing all clears the badge', () => {
  const store = setup();
  const alerts = store.sensorNotifications(reading, 'Loam');
  assert.equal(alerts.length, 6);
  store.markNotificationsRead('farmer', 1, alerts.slice(0, 5).map(alert => alert.id));
  const unread = () => alerts.filter(alert => !store.readNotificationIds(store.readNotificationSnapshot('farmer', 1)).includes(alert.id)).length;
  assert.equal(unread(), 1);
  store.markNotificationsRead('farmer', 1, alerts.map(alert => alert.id));
  assert.equal(unread(), 0);
});
test('read state persists, stays scoped to the account and zone, and does not hide new readings', () => {
  const store = setup();
  const ids = store.sensorNotifications(reading, 'Loam').map(alert => alert.id);
  store.markNotificationsRead('farmer', 1, ids);
  const seen = store.readNotificationIds(store.readNotificationSnapshot('farmer', 1));
  assert.equal(seen.length, 6);
  assert.equal(store.readNotificationIds(store.readNotificationSnapshot('other', 1)).length, 0);
  assert.equal(store.readNotificationIds(store.readNotificationSnapshot('farmer', 2)).length, 0);
  assert.equal(store.sensorNotifications({ ...reading, id: 2 }, 'Loam').filter(alert => !seen.includes(alert.id)).length, 6);
});
test('marking the same alerts twice does not repeatedly notify subscribers', () => {
  const store = setup();
  let updates = 0;
  const unsubscribe = store.subscribeNotificationReadState(() => updates++);
  store.markNotificationsRead('farmer', 1, ['alert']);
  store.markNotificationsRead('farmer', 1, ['alert']);
  assert.equal(updates, 1);
  unsubscribe();
  store.markNotificationsRead('farmer', 1, ['another']);
  assert.equal(updates, 1);
});
