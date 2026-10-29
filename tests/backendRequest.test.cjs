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
  await assert.rejects(request('/zones'), /took too long/);
  assert.equal(cleared, true);
});

test('HTTP failure is surfaced rather than accepted as an empty zone list', async () => {
  const request = load(async () => ({ ok: false, status: 503 }));
  await assert.rejects(request('/zones'), /503/);
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
