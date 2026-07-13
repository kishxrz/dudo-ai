export type ChatMessage = {
  sender: "customer" | "bot";
  text: string;
};

export type UseCase = {
  emoji: string;
  industry: string;
  pains: string[];
  gains: string[];
  chat: ChatMessage[];
};

export const useCases: UseCase[] = [
    {
      emoji: "🍕",
      industry: "Restaurant/Cafe",
      pains: ["Customers calling during busy hours to book table", "Repeatedly sending menu images manually"],
      gains: ["Instantly shares PDF menu & takes bookings", "Answers location, timing & delivery queries"],
      chat: [
        { sender: "customer", text: "Can you help me plan dinner for 4?" },
        { sender: "bot", text: "Absolutely! 🍕 Based on our popular picks, I'd recommend 2 Paneer Tikka Pizzas, Garlic Bread, and 4 drinks — perfect for a group of 4" },
        { sender: "customer", text: "Sounds good. Can you reserve a table for 8 PM too?" },
        { sender: "bot", text: "Done! 🎉 Your table is reserved for 4 guests at 8 PM, and your meal preferences are saved for faster ordering when you arrive" }
      ]
    },
    {
      emoji: "💇",
      industry: "Salon/Spa",
      pains: ["Managing appointment books while styling clients", "No-shows and forgetting reminders"],
      gains: ["Automated booking linked to calendar", "Sends automatic WhatsApp confirmations"],
      chat: [
        { sender: "customer", text: "Need slot for hair coloring tomorrow afternoon." },
        { sender: "bot", text: "Tomorrow we have slots at 2:00 PM and 4:30 PM with Priya. Which works best? 💇‍♀️" },
        { sender: "customer", text: "2:00 PM works." },
        { sender: "bot", text: "Perfect! Booking Priya at 2:00 PM tomorrow. I've sent a WhatsApp confirmation to your number. See you!" }
      ]
    },
    {
      emoji: "🏥",
      industry: "Healthcare/Clinic",
      pains: ["Receiving booking texts during surgery/consultations", "Patients asking for clinic address & fee"],
      gains: ["Handles appointment slot bookings 24/7", "Answers fees, timings, and doc availability"],
      chat: [
        { sender: "customer", text: "What is Dr. Shah's fee? Is he available today?" },
        { sender: "bot", text: "Dr. Shah's consultation fee is ₹500. He is in the clinic today from 5:00 PM - 8:00 PM. Book a slot?" },
        { sender: "customer", text: "Yes please, around 6 PM." },
        { sender: "bot", text: "I have booked slot #4 at 6:15 PM for you. Here is the clinic Google Maps location: [Map Link]" }
      ]
    },
    {
      emoji: "🛒",
      industry: "E-Commerce",
      pains: ["Answering 'is this in stock?' repeatedly", "Chasing users to complete checkout"],
      gains: ["Syncs catalogue & shares product links", "Sends automatic cart recovery links"],
      chat: [
        { sender: "customer", text: "Do you have the Oversized Black Hoodie in size M?" },
        { sender: "bot", text: "Yes! We have 4 items left in stock. Here's the product link. Would you like to buy it now?" },
        { sender: "customer", text: "Is shipping free?" },
        { sender: "bot", text: "Shipping is FREE on orders above ₹999. Since the hoodie is ₹1,299, shipping is free! Here is your checkout link: [Link]" }
      ]
    },
    {
      emoji: "🏠",
      industry: "Real Estate",
      pains: ["Chasing cold leads at midnight", "Manually sending brochure PDFs to everyone"],
      gains: ["Qualifies budget & location instantly", "Shares brochures, video tours, & maps"],
      chat: [
        { sender: "customer", text: "I'm looking for a 2BHK in Chennai under ₹80L." },
        { sender: "bot", text: "I found 3 matching properties 🏡 Green Meadows fits your budget best at ₹75L, with excellent connectivity and ready-to-move units" },
        { sender: "customer", text: "Looks good. I'd like to visit tomorrow morning" },
        { sender: "bot", text: "Done! 🏡 Your site visit is scheduled for tomorrow at 11:00 AM. The property details and location have been sent to you" }
      ]
    },
    {
      emoji: "💼",
      industry: "Freelancer/Agency",
      pains: ["Replying to basic service inquiry DMs on Sunday", "Manually asking budget/timeline for proposals"],
      gains: ["Instantly qualifies prospects via custom form", "Shares portfolio & books discovery calls"],
      chat: [
        { sender: "customer", text: "Hey! Do you build Shopify websites? What are your rates?" },
        { sender: "bot", text: "Hi! Yes, I build high-converting Shopify stores. My projects start at ₹50k. What niche is your brand in?" },
        { sender: "customer", text: "Apparel brand. We want to launch next month." },
        { sender: "bot", text: "Apparel is perfect! Here is my portfolio of stores. Let's book a short 15m discovery call: [Calendar Link]" }
      ]
    }
  ];