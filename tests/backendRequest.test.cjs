const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(fetch, timers = {}) {
  const context = { exports: {}, process: { env: {} }, AbortController, fetch, setTimeout, clearTimeout, ...timers };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/backendRequest.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports.backendRequest;
}

test('deadline cancellation becomes an actionable timeout message and clears the timer', async () => {
  let abort;
  let cleared = false;
  const request = load(async (_url, { signal }) => {
    abort();
    assert.equal(signal.aborted, true);
    throw new Error('Fetch request has been canceled');
  }, { setTimeout: fn => { abort = fn; return 1; }, clearTimeout: () => { cleared = true; } });
  await assert.rejects(request('/zones', { method: 'POST' }), /took too long/);
  assert.equal(cleared, true);
});

test('HTTP failure is surfaced rather than accepted as an empty zone list', async () => {
  let calls = 0;
  const request = load(async () => { calls++; return { ok: false, status: 404 }; });
  await assert.rejects(request('/zones'), /404/);
  assert.equal(calls, 1);
});

const fastTimers = {
  setTimeout: (fn, ms) => { if (ms === 1000) queueMicrotask(fn); return 1; },
  clearTimeout: () => {},
};

test('startup GET recovers after gateway and network failures', async () => {
  let calls = 0;
  const request = load(async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 503 };
    if (calls === 2) throw new TypeError('Network request failed');
    return { ok: true, json: async () => ({ data: [{ id: 23 }] }) };
  }, fastTimers);
  assert.equal((await request('/zones')).data[0].id, 23);
  assert.equal(calls, 3);
});

test('GET retries stop after three attempts', async () => {
  let calls = 0;
  const request = load(async () => { calls++; return { ok: false, status: 504 }; }, fastTimers);
  await assert.rejects(request('/zones'), /504/);
  assert.equal(calls, 3);
});

test('failed writes are never replayed', async () => {
  let calls = 0;
  const request = load(async () => { calls++; throw new TypeError('Network request failed'); }, fastTimers);
  await assert.rejects(request('/zones', { method: 'POST' }), /Network request failed/);
  assert.equal(calls, 1);
});

test('caller cancellation is not retried', async () => {
  let calls = 0;
  const controller = new AbortController();
  const request = load(async (_url, { signal }) => {
    calls++;
    controller.abort();
    assert.equal(signal.aborted, true);
    throw new Error('canceled');
  }, fastTimers);
  await assert.rejects(request('/zones', { signal: controller.signal }), /canceled/);
  assert.equal(calls, 1);
});

test('GET timeouts recover automatically with a fresh abort signal', async () => {
  let calls = 0;
  let abort;
  const request = load(async (_url, { signal }) => {
    calls++;
    assert.equal(signal.aborted, false);
    if (calls === 1) { abort(); throw new Error('canceled'); }
    return { ok: true, json: async () => ({ data: [] }) };
  }, {
    setTimeout: (fn, ms) => { if (ms === 1000) queueMicrotask(fn); else abort = fn; return 1; },
    clearTimeout: () => {},
  });
  assert.equal((await request('/zones')).data.length, 0);
  assert.equal(calls, 2);
});

test('successful assignment requests retain method and payload', async () => {
  const request = load(async (url, options) => {
    assert.equal(url.endsWith('/device/active-zone'), true);
    assert.equal(options.method, 'POST');
    assert.equal(options.body, '{"zone_id":23}');
    return { ok: true, json: async () => ({ zone: { id: 23 } }) };
  });
  assert.equal((await request('/device/active-zone', { method: 'POST', body: '{"zone_id":23}' })).zone.id, 23);
});
