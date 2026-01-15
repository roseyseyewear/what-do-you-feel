// Vercel Serverless Function for Claude API - RAIN-Style Integration
// Deploy to Vercel and add CLAUDE_API_KEY as environment variable

export const config = {
  runtime: 'edge',
};

interface InquiryEntry {
  question: string;
  answer: string;
  depth: number;
}

interface RequestBody {
  entries: InquiryEntry[];
  // Legacy support
  whatYouFeel?: string;
  whereYouFeelIt?: string;
  whatItNeeds?: string;
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: RequestBody = await request.json();

    // Handle both new format (entries) and legacy format
    let entries: InquiryEntry[] = body.entries || [];

    // Convert legacy format if needed
    if (!entries.length && (body.whatYouFeel || body.whereYouFeelIt || body.whatItNeeds)) {
      entries = [
        { question: 'What do you feel?', answer: body.whatYouFeel || '', depth: 0 },
        { question: 'Where do you feel it?', answer: body.whereYouFeelIt || '', depth: 0 },
        { question: 'What does it need?', answer: body.whatItNeeds || '', depth: 0 },
      ].filter(e => e.answer);
    }

    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

    if (!CLAUDE_API_KEY) {
      // Demo fallback - simple integration without AI
      const initial = entries.filter(e => e.depth === 0);
      const deeper = entries.filter(e => e.depth > 0);

      return new Response(JSON.stringify({
        coreFeeling: initial[0]?.answer || 'Something you shared.',
        bodyWisdom: initial[1]?.answer || 'Present in your body.',
        underlyingNeed: deeper.length > 0
          ? deeper[deeper.length - 1].answer
          : initial[2]?.answer || 'What you need.',
        integration: `You shared ${entries.length} reflections. There's a thread connecting what you feel to what you need.`,
        shift: 'Taking time to notice your experience is itself a form of self-care.',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build the inquiry transcript
    const transcript = entries.map((e, i) =>
      `Q${i + 1}: "${e.question}"\nA${i + 1}: "${e.answer}"`
    ).join('\n\n');

    const initialAnswers = entries.filter(e => e.depth === 0);
    const deeperAnswers = entries.filter(e => e.depth > 0);

    const systemPrompt = `You are a compassionate integration guide, trained in Tara Brach's RAIN method and somatic awareness.

A person just completed a brief emotional inquiry. They answered questions about what they feel, where they feel it in their body, and what it needs. Some may have gone deeper with follow-up questions.

Your role is to INTEGRATE and SYNTHESIZE their experience - not just echo it back, but help them see:
1. The core emotion beneath their words
2. What their body sensation might be communicating
3. What deeper need or fear might be underneath
4. The connecting thread between their responses
5. Any shift that happened through the inquiry itself

Be:
- Warm but not saccharine
- Insightful but grounded in THEIR words
- Concise (2-3 sentences max per section)
- Specific to what they actually said
- Attuned to what they DIDN'T say but might be feeling

IMPORTANT: Don't just reword what they said. Find the emotional truth underneath. Help them feel SEEN and understood at a level deeper than their surface words.

Respond ONLY with valid JSON in this exact format:
{
  "coreFeeling": "Name the core emotion(s) you sense beneath their words - what they're really feeling",
  "bodyWisdom": "What their body sensation might be telling them - connect sensation to meaning",
  "underlyingNeed": "The deeper need or longing underneath - what part of them is asking for attention",
  "integration": "The thread connecting their responses - what pattern or truth emerges when you see it all together",
  "shift": "Note any movement or softening that happened - or gently point toward what might help them integrate"
}`;

    const userPrompt = `Here's what emerged during this person's emotional inquiry:

${transcript}

${deeperAnswers.length > 0
  ? `\nThey chose to go deeper, exploring ${deeperAnswers.length} additional layer(s).`
  : '\nThey completed the basic inquiry.'}

Please provide an integration that helps them feel truly seen and understood. Find the emotional truth beneath their words.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
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
    // Handle potential markdown code blocks
    let jsonContent = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        jsonContent = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonContent);

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Processing error:', error);
    return new Response(JSON.stringify({
      coreFeeling: 'Something important surfaced for you today.',
      bodyWisdom: 'Your body is holding wisdom about this.',
      underlyingNeed: 'A part of you is asking for attention.',
      integration: 'By pausing to notice your experience, you\'ve already begun the work of integration.',
      shift: 'Consider sitting with what came up. Sometimes the noticing itself is the healing.',
    }), {
      status: 200, // Return 200 with fallback content instead of error
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
