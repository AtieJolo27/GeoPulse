/** All platforms use the hosted Python backend, independent of Metro. */
export function getApiBaseUrl(): string {
  const base = (process.env.EXPO_PUBLIC_API_URL ?? 'https://capstone-eem0.onrender.com').trim().replace(/\/+$/, '');
  const url = new URL(base);
  if (!__DEV__ && (url.protocol !== 'https:' || /^(localhost|127\.0\.0\.1|10\.0\.2\.2)$/.test(url.hostname))) {
    throw new Error('Release builds require a public HTTPS backend URL.');
  }
  return base;
}

export function getApiUrl(path: string): string {
  return `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}