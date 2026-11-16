const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/sensorConnection.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { sensorConnectionFromReading: status } = context.exports;
const now = Date.parse('2026-11-16T08:00:00Z');

test('recent sensor readings show online, including the one-minute boundary', () => {
  assert.equal(status(new Date(now - 3000).toISOString(), now), 'online');
  assert.equal(status(new Date(now - 60000).toISOString(), now), 'online');
});

test('stale or absent readings show offline', () => {
  assert.equal(status(new Date(now - 60001).toISOString(), now), 'offline');
  assert.equal(status(null, now), 'offline');
});

test('bad timestamps and future timestamps cannot claim the sensor is online', () => {
  assert.equal(status('invalid', now), 'unknown');
  assert.equal(status(new Date(now + 60000).toISOString(), now), 'unknown');
});
