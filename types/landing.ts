export type LandingFAQItem = {
  q: string;
  a: string;
};

export type LandingChatMessage = {
  sender: "customer" | "bot";
  text: string;
};

export type LandingUseCase = {
  emoji: string;
  industry: string;
  pains: string[];
  gains: string[];
  chat: LandingChatMessage[];
};

export type PricingFeature = {
  text: string;
  included: boolean;
};

export type PricingPlan = {
  badge?: string;
  name: string;
  price: string;
  period: string;
  oldPrice?: string;
  description: string;
  features: string[];
  actionText: string;
  actionHref: string;
  note?: string;
  popular?: boolean;
};

export type TestimonialItem = {
  category: string;
  quote: string;
  author: string;
  role: string;
  location: string;
  result: string;
  initials: string;
  stars: number;
  featured?: boolean;
};

export type StatsItem = {
  iconName: 'Bot' | 'Globe' | 'Clock' | 'ShieldCheck';
  value: string;
  label: string;
  desc: string;
};

export type SaasFeature = {
  iconName: "Coins" | "Languages" | "Globe";
  title: string;
  desc: string;
};
