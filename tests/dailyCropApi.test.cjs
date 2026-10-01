const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function endpoint(reply = '1. Inspect leaves.\n2. Check soil.\n3. Remove weeds.') {
  const calls = [];
  const context = { exports: {}, Response, process: { env: { GROQ_API_KEY: 'test' } }, console,
    require: () => ({ Groq: class {
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
