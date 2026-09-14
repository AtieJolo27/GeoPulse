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
      messages: [
        {
          role: 'system',
          content:
            `You are a farming assistant writing a concise, formal assessment that farmers can understand. Use short, plain sentences. Follow this exact format: "Assessment:" followed by one or two sentences, then "Recommended action:" followed by one or two sentences, then "References:". Base Philippine advice primarily on the DA-BSWM resources below. Do not invent, replace, or add sources:\n1. DA-BSWM FertMap: https://nshp.bswm.da.gov.ph/fertmap/\n2. DA-BSWM National Soil Health Program: https://nshp.bswm.da.gov.ph/\n3. FAO — Soil fertility: https://www.fao.org/global-soil-partnership/areas-of-work/soil-fertility/en/\nIn the recommended action, first suggest safe, practical nutrient-maintenance steps that match the readings—such as keeping soil covered with mulch, adding fully decomposed compost, returning safe crop residues, managing irrigation, or rotating with legumes. Then advise consulting the local DA agricultural technician for crop-specific fertilizer rates. Do not give exact fertilizer application rates. Keep the full response under 140 words.`,
        },
        { role: 'user', content: prompt },
      ],
      // Llama 3.3 70B was retired for developer-tier projects on Aug. 16, 2026.
      // GPT-OSS 20B is its supported, fast replacement for crop recommendations.
      model: 'openai/gpt-oss-20b',
      // This model uses some tokens for private reasoning before producing text.
      reasoning_effort: 'low',
      max_completion_tokens: 512,
    });

    const reply = completion.choices[0]?.message?.content?.trim();

    if (!reply) {
      console.warn('Groq returned no displayable content:', completion.choices[0]?.finish_reason);
      return Response.json(
        { error: 'AI could not create a recommendation. Please try again.' },
        { status: 502 }
      );
    }

    return Response.json({ data: reply });

  } catch (error: any) {
    console.error('Groq API error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
