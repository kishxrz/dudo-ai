export type FAQItem = {
  q: string;
  a: string;
};

export const faqItems: FAQItem[] = [
  {
    q: "What is Dudo?",
    a: "Dudo is your 24/7 AI employee designed specifically for small businesses. It connects directly to your WhatsApp Business and Telegram channels to handle customer inquiries, book appointments, qualify leads, and send product catalogs—all in your business's custom brand voice."
  },
  {
    q: "How does the 'Bring Your Own Key' (BYOK) work?",
    a: "Instead of charging you a massive premium on AI usage, Dudo lets you plug in your own API key from OpenAI, Claude, Gemini, or Groq. You pay the AI provider directly for the tokens you use (which is typically just cents per week). This ensures full transparency and zero hidden AI markups."
  },
  {
    q: "Does it support regional Indian languages?",
    a: "Absolutely. Dudo natively understands and replies in Tamil, Hindi, Telugu, Kannada, English, and even mixed colloquial language like Tanglish or Hinglish, just like your local customer service team would."
  },
  {
    q: "How long does the setup take?",
    a: "Less than 60 seconds. You select your industry templates, give your AI agent a name, configure its basic info, and link it to WhatsApp or Telegram. No code or complex prompt writing needed."
  },
  {
    q: "Can I use my existing WhatsApp Business number?",
    a: "Yes. You can link your existing WhatsApp Business number. Dudo integrates seamlessly, letting you automate conversations while still keeping your business identity."
  },
  {
    q: "Can I take over the chat from the AI at any time?",
    a: "Yes! There is a 1-click human handoff. Whenever you want to step in and message a client directly, you can disable the AI response for that chat in your simple dashboard."
  },
  {
    q: "Is there a free trial?",
    a: "Yes. We offer a 30-minute free trial on Telegram where you can connect your bot, customize its personality, and test its skills completely free without entering a credit card."
  }
];