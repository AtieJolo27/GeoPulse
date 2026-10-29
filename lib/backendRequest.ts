const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://capstone-eem0.onrender.com';

export async function backendRequest(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Server request failed (${response.status}). Please try again.`);
    }
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('The server took too long to respond. Please retry in a moment.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
