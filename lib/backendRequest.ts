const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://capstone-eem0.onrender.com';

export async function backendRequest(path: string, options: RequestInit = {}) {
  // Reads can safely recover while a sleeping backend starts. Never replay writes:
  // a timed-out POST may already have committed on the server.
  const attempts = (options.method ?? 'GET').toUpperCase() === 'GET' ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const timeout = setTimeout(cancel, attempts > 1 ? 25000 : 20000);
    let retryable = true;
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: controller.signal });
      if (!response.ok) {
        retryable = [502, 503, 504].includes(response.status);
        throw new Error(`Server request failed (${response.status}). Please try again.`);
      }
      // Invalid JSON is a response/configuration error, not a connection failure.
      retryable = false;
      return await response.json();
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (!retryable || attempt === attempts - 1) {
        if (controller.signal.aborted) {
          throw new Error('The server took too long to respond. Please retry in a moment.');
        }
        throw error;
      }
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', cancel);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
