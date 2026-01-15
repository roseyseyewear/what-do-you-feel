// Vercel Serverless Function for Claude API
// Deploy to Vercel and add CLAUDE_API_KEY as environment variable

export const config = {
  runtime: 'edge',
};

interface RequestBody {
  whatYouFeel: string;
  whereYouFeelIt: string;
  whatItNeeds: string;
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: RequestBody = await request.json();
    const { whatYouFeel, whereYouFeelIt, whatItNeeds } = body;

    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

    if (!CLAUDE_API_KEY) {
      // Fallback for demo mode - just return the input back organized
      return new Response(JSON.stringify({
        feeling: whatYouFeel || 'Something you shared.',
        location: whereYouFeelIt || 'Somewhere in your body.',
        need: whatItNeeds || 'Something you need.',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are a compassionate emotional processing assistant. The user just did a quick brain dump about what they're feeling. Your job is to ORGANIZE and REFLECT back what they shared in a clear, helpful way.

Be:
- Concise (1-2 sentences per section)
- Compassionate but not saccharine
- Clear and specific (use their words when possible)
- Actionable (especially for "what you need")

Respond ONLY with valid JSON in this exact format:
{
  "feeling": "A clear, distilled summary of the core emotion(s) they described",
  "location": "Where they feel it and what that body sensation might be telling them",
  "need": "A clear, actionable next step or insight about what they need"
}`;

    const userPrompt = `Here's what the user shared:

1. WHAT THEY FEEL: ${whatYouFeel || 'Not specified'}

2. WHERE THEY FEEL IT: ${whereYouFeelIt || 'Not specified'}

3. WHAT IT NEEDS: ${whatItNeeds || 'Not specified'}

Please organize and reflect this back to them.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      throw new Error('Claude API error');
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse the JSON response from Claude
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Processing error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to process',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
