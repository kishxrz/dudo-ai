import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  Timestamp 
} from 'firebase/firestore';

const TOPICS = [
  'Prompt Engineering',
  'AI Agents',
  'WhatsApp Automation',
  'Telegram Automation',
  'AI Memory',
  'AI Security',
  'Sales Automation',
  'Customer Support',
  'Marketing Automation',
  'Business Workflows',
  'Productivity'
];

// Pre-written high-quality templates for dev/offline mock fallbacks when API keys are missing
const MOCK_NEWSLETTERS: Record<string, any> = {
  'Prompt Engineering': {
    title: 'Mastering XML Demarcations for Agent Instructions',
    articleBody: 'Structuring prompt configurations inside your AI Employee determines their factual grounding. By wrapping directives in standard tags like &lt;rules&gt; or &lt;context&gt;, LLMs can cleanly isolate operating parameters from user message context. This prevents prompt injections and keeps agents contextually constrained.',
    tipOfTheWeek: 'Use XML tags explicitly. State "Refer ONLY to documents inside &lt;knowledge&gt; tags" to ground responses.',
    promptOfTheWeek: 'You are a billing support agent. Role rules:\n<rules>\n- Do NOT offer refunds directly.\n- Escalate to the boss via /takeover.\n</rules>',
    featureSpotlight: 'System Prompt Editor: Edit directives in real-time under Dudo Personality tab.',
    communityHighlight: 'Special thanks to @alex_dev for publishing their customer onboarding prompt guidelines!'
  },
  'AI Memory': {
    title: 'Stateful Context & Conversation Memory Retention',
    articleBody: 'AI Employees must remember previous user messages to handle compound inquiries. Dudo automatically saves a sliding context window of active sessions while summarizing older logs. This creates a stateful conversation thread without bloating the model token usage.',
    tipOfTheWeek: 'Clear session history regularly when testing new instructions using the reset command.',
    promptOfTheWeek: 'System prompt override:\n<context>\n- Access active room summary memory before outputting reply.\n</context>',
    featureSpotlight: 'Active Memory Logs: Review what the AI remembers on the Logs dashboard.',
    communityHighlight: 'Check out the thread by @sara_m on configuring long-term retention triggers.'
  },
  'WhatsApp Automation': {
    title: 'Designing Zero-Latency WhatsApp Customer Funnels',
    articleBody: 'WhatsApp is an instantaneous communication channel. Customers expect answers within seconds. By combining Dudo\'s high-priority queues with immediate lease acquisitions, your AI Employee can respond concurrently under 1.5 seconds, matching live agents.',
    tipOfTheWeek: 'Always include country code formatting (+91 etc.) to prevent routing delays.',
    promptOfTheWeek: 'Format all WhatsApp responses using bullet points and brief, clean paragraphs for mobile layouts.',
    featureSpotlight: 'WhatsApp Status QR: Instantly connect a new phone number in a single click.',
    communityHighlight: 'Congrats to FreshCart for passing 10,000 automated queries this month!'
  }
};

/**
 * Generates or picks a brand-new weekly Thursday newsletter using AI or pre-written mock templates.
 * Enforces automatic topic rotation and saves history.
 */
export async function generateWeeklyNewsletter(): Promise<{
  topic: string;
  title: string;
  articleBody: string;
  tipOfTheWeek: string;
  promptOfTheWeek: string;
  featureSpotlight: string;
  communityHighlight: string;
}> {
  let nextTopic = TOPICS[0];

  if (db) {
    try {
      const historyCol = collection(db, 'newsletter_history');
      const q = query(historyCol, orderBy('timestamp', 'desc'), limit(5));
      const snap = await getDocs(q);
      const usedTopics = snap.docs.map(d => d.data().topic);
      
      // Find the first topic not in the last 5 sends
      const available = TOPICS.filter(t => !usedTopics.includes(t));
      if (available.length > 0) {
        nextTopic = available[0];
      } else {
        // Rotate from index 0
        nextTopic = TOPICS[0];
      }
    } catch (e) {
      console.error('Failed to resolve newsletter history, falling back to default topic:', e);
    }
  }

  // 1. Check if AI API keys exist in the environment
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  let newsletterContent = MOCK_NEWSLETTERS[nextTopic] || MOCK_NEWSLETTERS['Prompt Engineering'];

  if (apiKey) {
    try {
      const endpoint = process.env.GROQ_API_KEY 
        ? 'https://api.groq.com/openai/v1/chat/completions' 
        : 'https://api.openai.com/v1/chat/completions';
      
      const model = process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

      const prompt = `You are a Senior Product Architect at Dudo AI. Generate a brand new, highly educational, professional weekly email newsletter about "${nextTopic}" automation.
      
      Format the response strictly as a JSON object with these fields:
      - title: A compelling subject title (max 60 characters)
      - articleBody: 2 paragraphs of clear, informative explanation (no promotional buzzwords)
      - tipOfTheWeek: One actionable configuration tip (max 2 sentences)
      - promptOfTheWeek: A short copy-pasteable system prompt example (markdown clean text)
      - featureSpotlight: A quick mention of a Dudo dashboard feature (max 15 words)
      - communityHighlight: A shoutout to a developer or milestone (max 15 words)

      Ensure output is valid JSON. Do not include markdown code block ticks outside the JSON.`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        if (parsed.title && parsed.articleBody) {
          newsletterContent = parsed;
          console.log(`[AI Newsletter] Successfully generated newsletter using LLM for topic: ${nextTopic}`);
        }
      } else {
        console.warn(`[AI Newsletter] LLM call failed with status: ${res.status}. Falling back to default mock templates.`);
      }
    } catch (err) {
      console.error('[AI Newsletter] Failed to generate via LLM, falling back to mock templates:', err);
    }
  } else {
    console.log(`[Dev Mock Newsletter] No LLM API key present. Resolving high-quality offline template for topic: ${nextTopic}`);
  }

  const result = {
    topic: nextTopic,
    ...newsletterContent
  };

  // Save generated newsletter to history to avoid duplicate topics
  if (db) {
    try {
      await addDoc(collection(db, 'newsletter_history'), {
        ...result,
        timestamp: Timestamp.now()
      });
    } catch (e) {
      console.error('Failed to log newsletter history:', e);
    }
  }

  return result;
}
