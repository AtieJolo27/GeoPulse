const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../lib/cropScheduleResponse.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { readCropScheduleResponse } = context.exports;
test('hosted 404 HTML becomes a deployment message instead of JSON parse error', async () => {
  await assert.rejects(readCropScheduleResponse(new Response('<!doctype html><html>Not found</html>', { status: 404 })), /Deploy the updated API/);
});
test('API errors preserve actionable messages and valid JSON is returned', async () => {
  await assert.rejects(readCropScheduleResponse(Response.json({ error: 'AI is unavailable' }, { status: 503 })), /AI is unavailable/);
  const parsed = await readCropScheduleResponse(Response.json({ harvest_date: '2027-01-15' }));
  assert.equal(parsed.harvest_date, '2027-01-15');
});
test('invalid payloads do not leak parser errors or HTML', async () => {
  for (const value of ['', 'undefined', 'null', '123']) {
    await assert.rejects(readCropScheduleResponse(new Response(value)), /unreadable response|invalid calendar/);
  }
});
