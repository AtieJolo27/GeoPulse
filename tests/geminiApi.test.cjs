const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function moduleAt(file, globals) {
  const context = { exports: {}, console, require, URL, ...globals };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}
const options = { messages: [{ role: 'system', content: 'Care rules' }, { role: 'system', content: 'JSON rules' }, { role: 'user', content: 'Rice' }], max_completion_tokens: 1024, response_format: { type: 'json_object' } };
function gemini(fetch, env = { GEMINI_PROXY_TOKEN: 'test-secret' }, timers = {}) {
  return moduleAt('lib/serverGemini.ts', { process: { env }, fetch, AbortController, setTimeout, clearTimeout, ...timers }).geminiCompletion;
}
test('Gemini calls the Oregon relay with server authentication and excludes thoughts', async () => {
  const complete = gemini(async (url, request) => {
    assert.equal(url, 'https://capstone-eem0.onrender.com/ai/gemini');
    assert.equal(url.includes('test-secret'), false);
    assert.equal(request.headers.Authorization, 'Bearer test-secret');
    assert.equal(request.headers['x-goog-api-key'], undefined);
    const body = JSON.parse(request.body);
    assert.deepEqual(body.messages, options.messages);
    assert.equal(body.max_completion_tokens, 1024);
    assert.equal(body.json_mode, true);
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'hidden', thought: true }, { text: '1. Inspect leaves.' }] } }] });
  });
  assert.equal((await complete(options)).choices[0].message.content, '1. Inspect leaves.');
});
test('Gemini rejects absent keys before fetching', async () => {
  await assert.rejects(gemini(() => assert.fail('must not fetch'), {})(options), error => error.status === 503);
});

test('relay URL can be configured but rejects insecure HTTP before sending secrets', async () => {
  const complete = gemini(async url => {
    assert.equal(url, 'https://oregon.example.com/ai/gemini');
    return Response.json({ candidates: [] });
  }, { GEMINI_PROXY_TOKEN: 'test', GEMINI_BACKEND_URL: 'https://oregon.example.com/' });
  await complete(options);
  await assert.rejects(gemini(() => assert.fail('must not fetch'), {
    GEMINI_PROXY_TOKEN: 'test', GEMINI_BACKEND_URL: 'http://insecure.example.com',
  })(options), error => error.status === 503);
});

test('relay deployment errors remain distinct from Google model errors', async () => {
  for (const [status, body, code] of [
    [404, { detail: 'Not Found' }, 'RELAY_NOT_DEPLOYED'],
    [401, { detail: 'Unauthorized' }, 'RELAY_UNAUTHORIZED'],
    [404, { error: { code: 'UPSTREAM_ERROR' } }, 'UPSTREAM_ERROR'],
  ]) {
    await assert.rejects(gemini(async () => Response.json(body, { status }))(options),
      error => error.status === status && error.code === code);
  }
});
test('Gemini errors preserve status without exposing upstream details', async () => {
  for (const status of [400, 403, 429, 503]) {
    await assert.rejects(gemini(async () => new Response('sensitive upstream detail', { status }))(options), error => error.status === status && !error.message.includes('sensitive'));
  }
});
test('Gemini rejects blocked or truncated output', async () => {
  for (const finishReason of ['SAFETY', 'MAX_TOKENS']) {
    const complete = gemini(async () => Response.json({ candidates: [{ finishReason, content: { parts: [{ text: 'partial' }] } }] }));
    assert.equal((await complete(options)).choices[0].message.content, '');
  }
});
test('Gemini deadline aborts the request and clears its timer', async () => {
  let abort, cleared = false;
  const complete = gemini(async (_url, { signal }) => { abort(); assert.equal(signal.aborted, true); throw new Error('aborted'); }, undefined, {
    setTimeout: fn => { abort = fn; return 1; }, clearTimeout: () => { cleared = true; },
  });
  await assert.rejects(complete(options), /aborted/);
  assert.equal(cleared, true);
});
test('existing advice endpoint selects Gemini and validates fertilizer cards', async () => {
  const advice = moduleAt('lib/fertilizerAdvice.ts', {});
  let calls = 0;
  const api = moduleAt('app/api/groq+api.ts', {
    Response, process: { env: { AI_PROVIDER: 'gemini', GEMINI_PROXY_TOKEN: 'test' } },
    require: name => name.includes('fertilizerAdvice') ? advice : name.includes('serverGemini') ? {
      geminiCompletion: async request => {
        calls++;
        assert.match(request.messages[0].content, /do not substitute a predicted crop/);
        return { choices: [{ message: { content: JSON.stringify({ assessment: 'No addition.', recommendations: [] }) } }] };
      },
    } : { Groq: class { constructor() { assert.fail('must not instantiate Groq'); } } },
  });
  const response = await api.POST(new Request('https://example.com/api/groq', { method: 'POST', body: JSON.stringify({ mode: 'fertilizer', format: 'cards', prompt: 'Assess soil' }) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).advice.recommendations.length, 0);
  assert.equal(calls, 1);
});
test('Gemini calendar output goes through the existing schedule validator', async () => {
  const dates = moduleAt('lib/plantingDate.ts', {});
  const calendar = moduleAt('lib/cropCalendar.ts', { require: () => dates });
  const api = moduleAt('app/api/crop-schedule+api.ts', {
    Response, process: { env: { AI_PROVIDER: 'gemini', GEMINI_PROXY_TOKEN: 'test' } },
    require: name => name.includes('plantingDate') ? dates : name.includes('cropCalendar') ? calendar : name.includes('serverGemini') ? {
      geminiCompletion: async request => {
        assert.equal(request.response_format.type, 'json_object');
        return { choices: [{ message: { content: JSON.stringify({ harvest_date: '2027-02-01', fertilizer_dates: ['2026-12-01'], explanation: 'Estimated dates.' }) } }] };
      },
    } : { Groq: class { constructor() { assert.fail('must not instantiate Groq'); } } },
  });
  const response = await api.POST(new Request('https://example.com/api/crop-schedule', { method: 'POST', body: JSON.stringify({ crop: 'rice', planted_on: '2026-11-01', soil_type: 'Loam', language: 'tagalog' }) }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).harvest_date, '2027-02-01');
});
test('Gemini classifies location and invalid-key errors without disclosing upstream text', async () => {
  for (const code of ['LOCATION_UNSUPPORTED', 'INVALID_KEY']) {
    const complete = gemini(async () => Response.json({ error: { code } }, { status: 400 }));
    await assert.rejects(complete(options), error => error.status === 400 && error.code === code && error.message === 'Gemini request failed');
  }
});

test('Gemini failures never invoke Groq even when its key is configured', async () => {
  for (const [status, code] of [[400, 'LOCATION_UNSUPPORTED'], [400, 'INVALID_KEY'], [429, 'UPSTREAM_ERROR'], [502, 'UPSTREAM_UNAVAILABLE'], [503, 'UPSTREAM_ERROR'], [504, 'UPSTREAM_TIMEOUT']]) {
    const complete = gemini(async () => Response.json({ error: { code } }, { status }),
      { GEMINI_PROXY_TOKEN: 'test', GROQ_API_KEY: 'test' }, {
        require: () => { assert.fail('Gemini must not load another provider'); },
      });
    await assert.rejects(complete(options), error => error.status === status && error.code === code);
  }
});