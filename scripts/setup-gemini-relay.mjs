// Prepare local server configuration without printing secrets.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = name => {
  const file = new URL(name, root);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};
const rootEnv = parseEnv(read('.env'));
const local = parseEnv(read('.env.local'));
const backend = { ...parseEnv(read('backend/.env')), ...parseEnv(read('backend/.env.local')) };
const token = local.GEMINI_PROXY_TOKEN || backend.GEMINI_PROXY_TOKEN || randomBytes(32).toString('hex');
const key = backend.GEMINI_API_KEY || local.GEMINI_API_KEY || rootEnv.GEMINI_API_KEY;
if (!key?.trim()) throw new Error('Set GEMINI_API_KEY in backend/.env or .env before running setup.');

function update(name, values) {
  let content = read(name);
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    content = pattern.test(content) ? content.replace(pattern, () => line) : `${content.trimEnd()}\n${line}\n`;
  }
  writeFileSync(fileURLToPath(new URL(name, root)), content);
}

update('backend/.env.local', { GEMINI_API_KEY: key, GEMINI_PROXY_TOKEN: token });
update('.env.local', {
  AI_PROVIDER: 'gemini',
  GEMINI_BACKEND_URL: 'https://capstone-eem0.onrender.com',
  GEMINI_PROXY_TOKEN: token,
});
console.log('Prepared .env.local and backend/.env.local with matching relay tokens. No hosted environments were changed.');
