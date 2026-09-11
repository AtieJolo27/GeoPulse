import { Groq } from 'groq-sdk';

// Initializes the Groq client with the server-side environment key
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Call the Groq Inference API safely from the server side
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-oss-20b', // Or your preferred Groq model
    });

    const reply = completion.choices[0]?.message?.content || 'No response';
    return Response.json({ data: reply });

  } catch (error: any) {
    console.error('Groq API error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
