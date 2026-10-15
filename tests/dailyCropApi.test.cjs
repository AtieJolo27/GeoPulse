const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function endpoint(reply = '1. Inspect leaves.\n2. Check soil.\n3. Remove weeds.') {
  const calls = [];
  const context = { exports: {}, Response, process: { env: { GROQ_API_KEY: 'test' } }, console,
    require: name => name.includes('fertilizerAdvice') ? adviceModule() : ({ Groq: class {
      chat = { completions: { create: async options => {
        calls.push(options);
        return { choices: [{ message: { content: reply } }] };
      } } };
    } }),
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/api/groq+api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return { post: body => context.exports.POST(new Request('http://localhost/api/groq', { method: 'POST', body: JSON.stringify(body) })), calls };
}
function adviceModule() {
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/fertilizerAdvice.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}

test('fertilizer cards return verified product metadata and sources', async () => {
  const api = endpoint(JSON.stringify({ assessment: 'Phosphorus is low.', recommendations: [{ id: 'ssp', reason: 'Supplies phosphorus without extra nitrogen.', url: 'https://invented.example' }] }));
  const response = await api.post({ mode: 'fertilizer', format: 'cards', prompt: 'Low phosphorus, high nitrogen.' });
  assert.equal(response.status, 200);
  const { advice } = await response.json();
  assert.equal(advice.recommendations[0].name, 'Single superphosphate');
  assert.equal(advice.recommendations[0].inDataset, false);
  assert.match(advice.recommendations[0].sources[0].url, /^https:\/\/extension\.umn\.edu\//);
  assert.equal(advice.recommendations[0].url, undefined);
  assert.equal(api.calls[0].response_format.type, 'json_object');
});

test('fertilizer cards reject invented products and malformed output', async () => {
  for (const reply of ['plain description', JSON.stringify({ assessment: 'Low nitrogen', recommendations: [{ id: 'invented', reason: 'Apply it' }] })]) {
    assert.equal((await endpoint(reply).post({ mode: 'fertilizer', format: 'cards', prompt: 'Assess soil' })).status, 502);
  }
});

test('fertilizer cards allow no addition without inventing a product', async () => {
  const response = await endpoint(JSON.stringify({ assessment: 'No nutrients are low.', recommendations: [] })).post({ mode: 'fertilizer', format: 'cards', prompt: 'Assess soil' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).advice.recommendations.length, 0);
});
test('daily mode uses care instructions and returns Groq content', async () => {
  const api = endpoint();
  const response = await api.post({ mode: 'daily-care', prompt: 'Rice, planted 20 days ago. Tagalog.' });
  assert.equal(response.status, 200);
  assert.match((await response.json()).data, /Inspect leaves/);
  assert.match(api.calls[0].messages[0].content, /three short numbered tasks/);
  assert.match(api.calls[0].messages[1].content, /Tagalog/);
});
test('existing recommendation format is preserved', async () => {
  const api = endpoint();
  await api.post({ prompt: 'Assess crop' });
  assert.match(api.calls[0].messages[0].content, /Assessment:/);
});
test('invalid input never calls Groq', async () => {
  const api = endpoint();
  for (const prompt of [null, {}, '', ' ', 'x'.repeat(12001)]) {
    assert.equal((await api.post({ prompt })).status, 400);
  }
  assert.equal(api.calls.length, 0);
});
test('empty model response reports failure', async () => {
  assert.equal((await endpoint('').post({ mode: 'daily-care', prompt: 'Rice' })).status, 502);
});

test('fertilizer mode includes crop, nutrient and cited-alternative rules', async () => {
  const api = endpoint();
  const response = await api.post({ mode: 'fertilizer', prompt: 'Eggplant, nitrogen 10 ppm.' });
  assert.equal(response.status, 200);
  const system = api.calls[0].messages[0].content;
  assert.match(system, /do not substitute a predicted crop/);
  assert.match(system, /only nutrients below the minimum/);
  assert.match(system, /outside the dataset and cite source/);
  assert.match(system, /understanding-phosphorus-fertilizers/);
  assert.ok(api.calls[0].max_completion_tokens >= 2048);
});
