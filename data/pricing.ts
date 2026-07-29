import { PricingPlan } from '@/types/landing';
 
export const pricingPlans: PricingPlan[] = [
  {
    badge: "START FREE",
    name: "Free Trial",
    price: "₹0",
    period: "30 mins access",
    description: "Perfect to connect your Telegram bot, test the automated features, and see Dudo AI work in real time.",
    features: [
      "30 Mins Telegram Bot Trial",
      "Telegram Channel Only",
      "1 Custom AI assistant agent",
      "Connect & test in under 60 seconds",
      "Handover to human in 1-click"
    ],
    actionText: "Start Free Trial",
    actionHref: "/signup",
    note: "No credit card required"
  },
  {
    badge: "RECOMMENDED",
    name: "Monthly Plan",
    price: "₹999",
    period: "/month",
    oldPrice: "₹1,999",
    description: "Get full WhatsApp & Telegram automation for your business.",
    features: [
      "WhatsApp + Telegram channels",
      "1 Custom AI assistant agent",
      "Handles bookings & scheduling",
      "Learns your custom menu & FAQ",
      "Google Calendar workspace sync",
      "Voice-based conversations",
      "Web search + image generation",
      "Standard customer support"
    ],
    actionText: "Get Started",
    actionHref: "/signup?plan=monthly",
    note: "Pay as you go"
  },
  {
    badge: "LAUNCH OFFER · FIRST 100 SEATS",
    name: "6-Month Pack",
    price: "₹2,499",
    period: "for 6 months",
    oldPrice: "₹5,994",
    description: "🔥 Equivalent to just ₹416/month - limited seats!",
    features: [
      "6 Months Full Pro Access",
      "WhatsApp + Telegram channels",
      "1 Custom AI assistant agent",
      "Handles bookings & scheduling",
      "Learns your custom menu & FAQ",
      "Voice-based conversations",
      "Web search + image generation",
      "Priority 24/7 customer support"
    ],
    actionText: "Claim Launch Offer",
    actionHref: "/signup?plan=6months",
    note: "Only for the first 100 customers",
    popular: true
  }
];
