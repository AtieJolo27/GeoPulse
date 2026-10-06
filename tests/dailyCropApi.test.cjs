const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function api(base, dev = false) {
  const context = { exports: {}, URL, __DEV__: dev, process: { env: { EXPO_PUBLIC_API_URL: base } } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/apiConfig.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}

test('standalone APK uses hosted backend without Metro', () => {
  assert.equal(api().getApiUrl('/api/groq'), 'https://capstone-eem0.onrender.com/api/groq');
});
test('configured backend is shared and trailing slashes are normalized', () => {
  const client = api('https://example.com///');
  assert.equal(client.getApiUrl('api/groq'), 'https://example.com/api/groq');
  assert.equal(client.getApiUrl('/zones'), 'https://example.com/zones');
});
test('release builds reject insecure or emulator backend URLs', () => {
  for (const base of ['http://localhost:8000', 'http://10.0.2.2:8000', 'https://localhost', 'http://example.com']) {
    assert.throws(() => api(base).getApiBaseUrl(), /public HTTPS/);
  }
});
test('development can explicitly select a local Python backend', () => {
  assert.equal(api('http://192.168.1.20:8000', true).getApiUrl('/api/groq'), 'http://192.168.1.20:8000/api/groq');
});