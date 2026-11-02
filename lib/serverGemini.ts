// Server-only: imported by Expo API routes, never by mobile components.
import { Groq } from 'groq-sdk';
type CompletionOptions = {
  model?: string;
  reasoning_effort?: string;
  messages: { role: string; content: string }[];
  max_completion_tokens: number;
  response_format?: { type: string };
};

export async function geminiCompletion(options: CompletionOptions) {
  const token = process.env.GEMINI_PROXY_TOKEN?.trim();
  if (!token) throw Object.assign(new Error('Gemini relay is not configured'), { status: 503 });
  const baseUrl = process.env.GEMINI_BACKEND_URL?.trim().replace(/\/+$/, '') || 'https://capstone-eem0.onrender.com';
  if (new URL(baseUrl).protocol !== 'https:') throw Object.assign(new Error('Gemini backend requires HTTPS'), { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(`${baseUrl}/ai/gemini`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: options.messages,
        max_completion_tokens: options.max_completion_tokens,
        json_mode: options.response_format?.type === 'json_object',
      }),
    });
    // Never return upstream error bodies: they may contain request details.
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      const code = ['LOCATION_UNSUPPORTED', 'INVALID_KEY', 'NOT_CONFIGURED', 'UPSTREAM_ERROR'].includes(failure?.error?.code)
        ? failure.error.code : response.status === 404 ? 'RELAY_NOT_DEPLOYED'
          : response.status === 401 ? 'RELAY_UNAUTHORIZED' : 'UPSTREAM_ERROR';
      if (code === 'LOCATION_UNSUPPORTED' && process.env.GROQ_API_KEY?.trim()) {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY.trim(), timeout: 25000, maxRetries: 0 });
        return await groq.chat.completions.create({
          messages: options.messages as { role: 'system' | 'user' | 'assistant'; content: string }[],
          model: 'openai/gpt-oss-20b',
          reasoning_effort: 'low',
          max_completion_tokens: options.max_completion_tokens,
          ...(options.response_format ? { response_format: { type: 'json_object' as const } } : {}),
        });
      }
      throw Object.assign(new Error('Gemini request failed'), { status: response.status, code });
    }
    const body = await response.json();
    const candidate = body.candidates?.[0];
    const content = (candidate?.content?.parts ?? [])
      .filter((part: { text?: string; thought?: boolean }) => !part.thought && typeof part.text === 'string')
      .map((part: { text: string }) => part.text).join('').trim();
    return { choices: [{ message: { content: candidate?.finishReason === 'STOP' ? content : '' }, finish_reason: candidate?.finishReason }] };
  } finally { clearTimeout(timer); }
}
