import { generateAdvice } from './groq+api';

export async function POST(request: Request) {
  return generateAdvice(request, 'gemini');
}
