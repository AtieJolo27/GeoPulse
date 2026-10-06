const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function config({ hosted, dev = false, platform = 'android', host = '192.168.1.20:8081' } = {}) {
  const context = { exports: {}, URL, __DEV__: dev, process: { env: { EXPO_PUBLIC_GROQ_API_URL: hosted } },
    require: name => name === 'react-native' ? { Platform: { OS: platform } } : { expoConfig: { hostUri: host } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/apiConfig.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}
test('hosted Groq URL takes precedence over Metro and normalizes trailing slash', () => {
  assert.equal(config({ hosted: 'https://geopulse.expo.app/', dev: true }).getApiUrl('/api/groq'), 'https://geopulse.expo.app/api/groq');
});
test('release APK requires a configured HTTPS hosting URL', () => {
  assert.throws(() => config().getApiUrl('/api/groq'), /EXPO_PUBLIC_GROQ_API_URL/);
  assert.throws(() => config({ hosted: 'http://example.com' }).getApiUrl('/api/groq'), /HTTPS/);
});
test('Expo Go still uses the local route before hosting is configured', () => {
  assert.equal(config({ dev: true }).getApiUrl('/api/groq'), 'http://192.168.1.20:8081/api/groq');
});
test('hosted web uses the same-origin API route', () => {
  assert.equal(config({ platform: 'web' }).getApiUrl('/api/groq'), '/api/groq');
});
