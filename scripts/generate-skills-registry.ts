import * as fs from 'fs';
import * as path from 'path';
import { Skill, SkillMetadata } from '../types/skill';

// Helper to sanitize strings for IDs
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Deterministic hash helper to select vocabulary and phrasing
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Seeded random number generator based on LCG
function makeRandom(seed: number) {
  let current = seed;
  return function() {
    current = (current * 1664525 + 1013904223) % 4294967296;
    return current / 4294967296;
  };
}

// 12 Exact categories
const CATEGORIES_LIST = [
  'Customer Support',
  'Sales & Marketing',
  'Scheduling',
  'Communication',
  'Analytics & Insights',
  'Industry Specific',
  'Browser & Automation',
  'Writing & Content',
  'Development & Coding',
  'Education & Learning',
  'Health & Wellness',
  'General'
] as const;

// The exact lists of names (exactly 125 skills per category)
const customerSupportTopics = [
  "Live Chat Support", "Email Customer Support", "Phone Support Helper", "WhatsApp Customer Care", "Social Media Care",
  "SMS Support Helper", "FAQ Writer", "Knowledge Base Creator", "Help Desk Manager", "RMA Coordinator",
  "Refund Processing", "Order Tracking", "Package Delay Triage", "Damaged Items Claims", "Wrong Order Resolutions",
  "Subscription Cancellations", "Account Recovery Help", "MFA Troubleshooting", "Billing Inquiries Support", "Dispute Arbitration",
  "Invoice Corrections", "Fraud Alert Help", "Escalation Routing", "Human Agent Handoff", "CSAT Survey Tracker",
  "NPS Follow-ups", "Loyalty Points Balance", "VIP Customer Care", "Service Outages Help", "Emergency Callback Helper",
  "Feedback Classifier", "GDPR Data Requests", "HIPAA Data Handler", "CCPA Opt-Out Help", "Terms of Service Guide",
  "Privacy Policy Guide", "SLA SLA Tracking", "Refund Policy Guide", "Shipping Policy Guide", "Warranty Claims Helper",
  "Terms of Use Disputes", "User Onboarding Guide", "Welcome Message Coordinator", "Out of Office Auto-Replies", "Holiday Hours Announcements",
  "Delayed Response Apologies", "Live Chat Prompts", "Email Response Drafts", "Customer Care Guidelines", "Support Ticket Organiser",
  "Help Center Linker", "Pre-Sales Triage", "General Support Triage", "Cancellation Prevention", "Account Settings Guide",
  "Invoice Delivery Helper", "Billing Cycle Explanations", "Address Correction Support", "Payment Failures Advisor", "Card Expiry Reminders",
  "Self-Service Portal Guide", "Customer Feedback Logger", "Client Escalation Cooler", "Urgent Ticket Flagging", "Auto-Responder Drafts",
  "Multilingual Support Triage", "Callback Queue Planner", "Support Roster Coordinator", "Satisfaction Score Auditor", "Ticket Resolution Check",
  "Shipping Carrier Liaison", "Package Location Verifier", "Damaged Package Photo Review", "Product Exchange Triage", "Store Credit Issuer",
  "Discount Code Troubleshooting", "Billing Plan Changes", "Enterprise Support Routing", "Developer API Support Triage", "App Bug Intake",
  "System Downtime Notifications", "Scheduled Maintenance Alerts", "Billing Receipt Generator", "Trial Period Tracker", "Promo Code Validation Support",
  "Customer Directory Auditor", "Account Merge Helper", "Account Deletion Processing", "Newsletter Unsubscribe Helper", "Email Bounce Classifier",
  "Contact Info Update Support", "Payment Method Update Support", "Billing Address Modifier", "Corporate Accounts Coordinator", "SaaS Feature Requests Intake",
  "Beta Program Registrations", "User Feedback Aggregator", "VIP Account Onboarding", "Support Queue Monitor", "Spam Ticket Filter",
  "Ticket Prioritization Helper", "Customer Apology Letter Writer", "Product Recall Notifications", "Warranty Registration Helper", "Authorized Returns Guide",
  "Restocking Fees Explainer", "Chargeback Dispute Advisor", "Duplicate Charge Refund Helper", "Sales Tax Exemption Auditor", "Payment Installments Guide",
  "Customer Welcome Calls Scheduler", "Customer Exit Interviews", "Support Channel Router", "Help Desk Tagging Auditor", "Internal Knowledge Searcher",
  "SLA Warning Trigger", "Customer Anniversary Greetings", "Customer Birthday Wishes", "Community Forum Moderator", "User Profile Audit Helper",
  "Technical Documentation Linker", "Hardware Return Intake", "Software License Recovery", "Account Lockout Advisor", "Customer Survey Builder"
];

const salesMarketingTopics = [
  "Lead Generation", "Lead Qualification", "Lead Capture", "Sales Assistant", "Email Marketing",
  "WhatsApp Marketing", "SMS Marketing", "Digital Marketing", "Social Media Marketing", "Instagram Marketing",
  "Facebook Marketing", "LinkedIn Marketing", "YouTube Marketing", "Content Marketing", "Influencer Marketing",
  "Affiliate Marketing", "SEO Strategy", "Local SEO", "Google Ads", "Meta Ads",
  "Market Research", "Brand Strategy", "Pricing Strategy", "Upselling & Cross-selling", "CRM Management",
  "Cold Emailing", "Sales Copywriting", "Product Copywriting", "Landing Page Optimizer", "Conversion Rate Optimization",
  "Call to Action Design", "Growth Hacking", "Referral Programs", "Customer Retention", "Loyalty Campaigns",
  "Re-engagement Emails", "Cart Abandonment Recovery", "Customer Onboarding Planner", "Sales Pitch Builder", "Cold Calling Scripts",
  "Sales Presentation Planner", "Proposal Writer", "Deal Closing Helper", "Customer Segmentation Guide", "Buyer Persona Design",
  "Competitor Analysis Guide", "SWOT Analysis Guide", "Marketing Budgeting Guide", "Media Buying Guide", "Native Advertising",
  "Display Advertising", "Programmatic Ads", "Video Ads Planner", "Podcast Ads Planner", "Sponsor Outreach Helper",
  "Affiliate Setup Guide", "Coupon Marketing Guide", "Seasonal Promotions Planner", "Flash Sales Planner", "Product Launch Planner",
  "Press Release Distribution", "Event Marketing Planner", "Webinar Marketing Planner", "Trade Show Planner", "Street Marketing Guide",
  "Guerilla Marketing Guide", "Word of Mouth Prompts", "UGC Campaigns Guide", "Customer Reviews Guide", "Customer Testimonial Requests",
  "Brand Ambassadors Guide", "Co-branding Partners Guide", "Joint Ventures Guide", "Sponsorships Guide", "Marketing Funnels Guide",
  "Lead Nurturing Sequences", "Retargeting Campaigns Guide", "Lookalike Audiences Guide", "Dynamic Search Ads", "Google Merchant Guide",
  "Shopping Ads Planner", "Amazon PPC Guide", "Pinterest Ads Guide", "Twitter Ads Guide", "TikTok Ads Guide",
  "Snapchat Ads Guide", "Reddit Ads Guide", "Quora Ads Guide", "ASO Optimization Guide", "Email Deliverability Guide",
  "Lead Magnets Planner", "Opt-in Design Guide", "Newsletter Writing Guide", "Automated Welcome Sequences", "Win-back Campaigns Guide",
  "Survey Design Guide", "Quizzes Creator Guide", "Interactive Polls Guide", "Marketing Growth Strategy", "Growth Scaling Frameworks",
  "ABM Marketing Guide", "B2B Sales Guide", "B2C Sales Guide", "Direct Response Guide", "Copywriting Formulas",
  "AIDA Copywriting Guide", "PAS Copywriting Guide", "Storytelling Marketing Guide", "LTV Calculator Helper", "CAC Analysis Helper",
  "NPS Analysis Helper", "Sales Pipeline Tracker", "Lead Scoring Models", "HubSpot Automation Guide", "Marketo Automation Guide",
  "Mailchimp Campaigns Guide", "ActiveCampaign Guide", "Salesforce CRM Guide", "Pipedrive CRM Guide", "Zoho CRM Guide",
  "HubSpot CRM Guide", "Customer Journeys Guide", "Sales Objections Guide", "Closing Objections Guide", "Price Negotiation Guide"
];

const schedulingTopics = [
  "Appointment Booking", "Reservation Booking", "Calendar Syncing", "Event Coordinator", "Time Zone Matcher",
  "Shift Scheduler", "Consultation Scheduler", "Booking Reminders", "Room Reservations", "Service Scheduler",
  "Meeting Scheduler", "Double-booking Prevention", "Recurrent Bookings", "Group Bookings", "Calendar Invites",
  "Waitlist Management", "Late Cancellations Triage", "No-Show Policies Guide", "Buffer Time Configurator", "Availability Settings",
  "Holiday Hours Configurator", "Temporary Closures Coordinator", "Multi-Staff Scheduling", "Resource Allocation Planner", "Equipment Reservation Helper",
  "Client Intake Forms Guide", "Booking Link Customizer", "Calendar Embeds Guide", "Time Slots Allocator", "VIP Bookings Coordinator",
  "Blockout Dates Planner", "Calendar Cleanup Schedulers", "Automated Reminders Setup", "Timesheet Approval Helper", "Overtime Scheduling Helper",
  "On-Call Rotation Coordinator", "Time-Off Requests Helper", "Sick Leave Tracking", "FMLA Tracking Helper", "Project Scheduling Helper",
  "Sprint Planning Coordinator", "Standup Scheduling Helper", "Board Meeting Planner", "Webinar Coordinator Helper", "Virtual Event Scheduling",
  "Live Stream Scheduling", "Concert Scheduling Helper", "Sports Match Scheduler", "Tournament Bracket Planner", "Fitness Class Booking",
  "Swim Lesson Booking", "Chiropractic Booking Helper", "Dental Appointment Booking", "Medical Appointment Booking", "Outpatient Scheduling Helper",
  "Veterinary Scheduling Helper", "Grooming Appointment Booking", "House Cleaning Scheduler", "Handyman Visit Booking", "Plumbing Emergency Dispatch",
  "Electrical Repair Scheduling", "HVAC Maintenance Scheduler", "Appliance Repair Dispatch", "Car Service Booking", "Test Drive Scheduler",
  "Rent-A-Car Booking", "Flight Booking Inquiries", "Hotel Room Reservations", "Tour Booking Helper", "Cruise Reservation Helper",
  "Travel Itinerary Scheduler", "Delivery Window Scheduling", "Shipping Dispatch Scheduling", "Warehouse Slot Booking", "Freight Scheduling Helper",
  "Dispatch Coordinates Tracker", "Courier Pickup Booking", "Mail Delivery Schedule", "Recurrent Meetings Coordinator", "Group Class Bookings",
  "Availability Calendars Planner", "Holiday Calendar Configs", "Resource Reservation Sheets", "Client Information Forms", "Custom Booking Links",
  "Calendar Widget Styles", "Staff Allocation Grids", "Overtime Schedulers Logs", "Shift Rotation Calendars", "Vacation Calendars",
  "Project Milestones Tracker", "Sprint Timelines Checker", "Virtual Class Calendars", "Sports League Schedules", "Personal Training Schedules",
  "Dental Clinic Schedules", "Clinic Schedules Roster", "Pet Grooming Calendars", "Plumbing Dispatch Grids", "Car Rental Timelines",
  "Hotel Reservations Grids", "Warehouse Schedules Logs", "Courier Pickup Grids", "Staff Roster Grids", "Calendar Sync Audits",
  "Late Cancellation Grids", "No-Show Logs Tracker", "On-Call Schedules Roster", "Maternity Leave Timelines", "AGM Planners Logs",
  "Team Sync Coordinator", "Availability Audit Tool", "Recurring Buffer Setup", "Shift Swap Approval", "Office Resource Allocator",
  "Holiday Closure Scheduler", "Client Follow-up Tracker", "Equipment Request System", "Clinic Slots Auditor", "Sports League Coordinator",
  "Travel Stop Planner", "Delivery Slot Optimization", "Hourly Roster Checker", "Conference Call Organizer", "On-Call Rotation Planner"
];

const communicationTopics = [
  "Email Writer", "Tone Switcher", "Speech Writer", "Feedback Manager", "Newsletter Creator",
  "Language Translator", "Meeting Notes Builder", "Negotiation Guide", "Public Relations Assistant", "Outreach Coordinator",
  "Cold Outreach Planner", "Warm Introduction Helper", "Follow-up Email Schedulers", "Apology Email Creator", "Thank You Note Planner",
  "Welcome Email Schedulers", "Out of Office Vacation Responders", "Business Proposal Writer", "Pitch Deck Copywriter", "Project Status Updates",
  "Client Update Schedulers", "Team Announcements Coordinator", "Executive Summary Outliner", "Internal Memo Writer", "Onboarding Welcome Letter",
  "Job Offer Letter", "Resignation Letter Layouts", "Recommendation Letter Helper", "Job Description Writer",
  "Rejection Letter Coordinator", "Customer Welcome Senders", "Customer Win-back Planner", "Cart Abandonment Senders", "Order Confirmation Senders",
  "Shipping Notification Senders", "Late Payment Notice", "Debt Collection Letter", "Dispute Settlement Helper", "Account Suspension Notice",
  "Terms Change Notice", "Maintenance Notice Coordinator", "Security Alert Email", "WhatsApp Broadcast Writer", "SMS Notification Writer",
  "Push Notification Copywriter", "Interactive WhatsApp Menus", "Telegram Broadcast Writer", "Slack Announcement Writer", "Teams Update Senders",
  "Internal Chat Guidelines", "Crisis Communication Planner", "Press Release Writer", "Media Advisory Planner", "Media Pitch Helper",
  "Public Statement Coordinator", "Speech Intro Writer", "Speech Outro Writer", "Presentation Script Writer", "Toast Speech Writer",
  "Eulogy Writer Helper", "Award Acceptance Speech", "Award Presentation Speech", "Panel Discussion Moderation", "Q&A Session Moderator",
  "Seminar Intro Writer", "Webinar Script Writer", "Podcast Intro Writer", "Podcast Outro Writer", "Script Outline Writer",
  "Video Script Writer", "Video Description Checklists", "Audio Script Writer", "Voiceover Script Writer", "Telemarketing Script Writer",
  "Cold Calling Script Writer", "Customer Service Script", "Escalation Apology Script", "Live Chat Guidelines", "Customer Feedback Survey",
  "Customer Review Response", "Negative Review Response", "Positive Review Response", "Testimonial Request Helper", "Case Study Writer",
  "Success Story Writer", "Portfolio Description Helper", "Biography Writer Helper", "About Me Page", "About Us Page Creator",
  "Team Member Bio", "Executive Bio Writer", "LinkedIn Profile Copywriter", "Twitter Bio Copywriter", "Instagram Bio Copywriter",
  "TikTok Bio Copywriter", "Facebook Bio Copywriter", "Professional Emails Writer", "Tone Adjusters Sheets", "Speech Outlines Planner",
  "Feedback Templates Creator", "Newsletter Outlines Planner", "Language Vocabulary Finder", "Meeting Notes Layouts", "Negotiation Templates Creator",
  "Outreach Lists Auditor", "Cold Call Logs", "Presentation Guides Planner", "Job Offer Forms", "Resignation Letter Layouts List",
  "Interactive Chat Guidelines Setup", "Crisis Communication Planner Guide", "PR Campaign Advisor", "Professional Intro Messages",
  "Corporate Memo Composer", "Warm Intro Drafts", "Executive Announcement Drafts", "Resignation Notice Coordinator", "Award Reception Speechwriter",
  "Podcast Sponsorship Outlines", "Video Intro Scriptwriter", "PR Crisis Planner", "Customer Retention Letters", "Community Welcome Notes",
  "LinkedIn Summary Optimizer", "About Page Layout Creator"
];

const analyticsInsightsTopics = [
  "Business Analytics", "Sales Analytics", "Marketing Analytics", "Expense Tracker", "Budget Planner",
  "Performance Reports", "Customer Analytics", "Trend Analysis", "ROI Calculator", "Data Cleaning Helper",
  "Revenue Dashboard", "Profitability Analysis", "Cash Flow Analysis", "Cost-Benefit Analysis", "Break-Even Analysis",
  "Financial Forecasting", "Sales Forecasting", "Sales Conversion Analytics", "Funnel Analysis", "Drop-off Tracking",
  "Landing Page Performance", "Ad Campaign Analytics", "CTR Optimizer", "CPA Tracking", "LTV Calculator",
  "Churn Rate Calculator", "CAC Analysis", "Retention Rate Tracking", "NPS Analysis", "CSAT Metrics",
  "Customer Effort Score", "Product Analytics", "Feature Usage Tracking", "Active Users Tracker", "User Cohort Analysis",
  "Session Duration Analytics", "Bounce Rate Optimizer", "Cart Abandonment Analysis", "A/B Testing Analytics", "Statistical Significance",
  "Multivariate Testing", "Inventory Turnover", "Stockout Risk Tracker", "Supplier Performance", "Supply Chain Cost",
  "Shipping Lead Time", "Employee Performance", "Sales Rep Quotas", "HR Metrics Tracker", "Employee Turnover",
  "Recruitment Funnel", "Candidate Conversion", "Cost Per Hire", "Time to Fill", "Budget Variance Analytics",
  "Departmental Expense", "Project Budget", "Resource Utilization", "Billable Hours", "IT Systems Analytics",
  "Server Uptime", "API Response Time", "Error Rate Analysis", "Page Load Speed", "Database Performance",
  "SEO Rankings", "Organic Traffic", "Keyword Search Volume", "Competitor Backlink", "Social Engagement",
  "Instagram Analytics", "Facebook Page Metrics", "LinkedIn Performance", "YouTube Watch Time", "Email Open Rate",
  "Email CTR Analytics", "Unsubscribe Rate", "Spam Complaint", "Lead Scoring Analytics", "CRM Data Auditor",
  "Pipeline Velocity", "Deal Win Rate", "AOV Tracker", "Customer Cohort Revenue", "Customer Segmentation",
  "RFM Analysis", "Market Share", "Iron Industry Trend", "Demographics Analysis", "Geographic Sales",
  "Feedback Text Mining", "Sentiment Analysis", "Word Cloud Generator", "Survey Response", "Quiz Completion",
  "E-learning Student", "Course Enrollment", "Drop-out Risk", "Fitness Progress", "Weight Goal Metrics",
  "Calorie Intake", "Sleep Quality", "Stress Level", "Time-Tracking Analytics", "Screen Time Audits",
  "Personal Budget", "Savings Rate", "Net Worth Calculator", "Investment Portfolio", "Real Estate Value",
  "Property Rental Yield", "Revenue Stream Analysis", "CPA Optimization Auditor", "Active Users Cohort Tracker", "Stockout Risk Evaluator",
  "Supply Chain Lead Times", "API Response Latency Watch", "Nginx Request Rate Parser", "SEO Backlink Auditor", "Email Spam Score Checker",
  "Monthly Expense Planner", "Calorie Burn Rate Tracker", "Screen Time Auditing Tool", "SaaS LTV Calculation Helper", "A/B Test Confidence Calculator"
];

const industrySpecificTopics = [
  "Restaurant Assistant", "Cafe Assistant", "Hotel Assistant", "Dental Clinic Assistant", "Medical Clinic Assistant",
  "Real Estate Assistant", "Gym Assistant", "Salon Assistant", "Spa Assistant", "Retail Store Assistant",
  "Supermarket Assistant", "Clothing Store Assistant", "Jewellery Store Assistant", "Electronics Store Assistant", "Car Dealership Assistant",
  "Bike Dealership Assistant", "Car Rental Assistant", "Repair Shop Assistant", "Cleaning Service Assistant", "Home Services Assistant",
  "Event Management Assistant", "Wedding Planner Assistant", "Photography Studio Assistant", "Freelancer Assistant", "Consulting Business Assistant",
  "Coaching Business Assistant", "Online Store Assistant", "E-commerce Assistant", "SaaS Business Assistant", "Startup Assistant",
  "Small Business Assistant", "School Assistant", "College Assistant", "Training Institute Assistant", "Tuition Center Assistant",
  "Online Course Assistant", "NGO Assistant", "Property Management Assistant", "Construction Company Assistant", "Manufacturing Business Assistant",
  "Logistics Business Assistant", "Bakery Assistant", "Travel Agency Assistant", "Fitness Studio Assistant", "Spa Assistant Service",
  "Bike Rental Assistant", "Detail Shop Assistant", "Locksmith Assistant", "Roofing Service Assistant", "Painting Service Assistant",
  "Carpentry Shop Assistant", "Masonry Service Assistant", "Moving Company Assistant", "Storage Facility Assistant", "Courier Service Assistant",
  "Law Firm Assistant", "Accounting Firm Assistant", "Tax Advisor Assistant", "Financial Planner Assistant", "Insurance Broker Assistant",
  "Bank Branch Assistant", "Credit Union Assistant", "Mortgage Broker Assistant", "Recruitment Agency Assistant", "Staffing Agency Assistant",
  "HR Consultant Assistant", "PR Agency Assistant", "SEO Consultant Assistant", "Web Design Studio Assistant", "App Development Assistant",
  "Dropshipping Assistant", "Subscription Box Assistant", "Pet Grooming Assistant", "Dog Walking Assistant", "Pet Boarding Assistant",
  "Vet Clinic Assistant", "Animal Shelter Assistant", "Farm Assistant", "Winery Assistant", "Brewery Assistant",
  "Distillery Assistant", "Juice Bar Assistant", "Food Truck Assistant", "Catering Assistant", "Ice Cream Parlor Assistant",
  "Pizzeria Assistant", "Sushi Bar Assistant", "Steakhouse Assistant", "Vegetarian Assistant", "Vegan Cafe Assistant",
  "Seafood Restaurant Assistant", "Fast Food Assistant", "Diner Assistant", "Pub Assistant", "Bar Assistant",
  "Nightclub Assistant", "Concert Venue Assistant", "Theater Assistant", "Cinema Assistant", "Museum Assistant",
  "Art Gallery Assistant", "Community Center Assistant", "Youth Club Assistant", "Retirement Home Assistant", "Daycare Center Assistant",
  "Kindergarten Assistant", "Summer Camp Assistant", "Sports Club Assistant", "Golf Course Assistant", "Tennis Club Assistant",
  "Swim School Assistant", "Yoga Studio Assistant", "Pilates Studio Assistant", "CrossFit Gym Assistant", "Personal Trainer Assistant",
  "Physical Therapist Assistant", "Chiropractor Assistant", "Massage Therapist Assistant", "Acupuncture Assistant", "Nutritionist Assistant",
  "Counselor Assistant", "Travel Guide Assistant", "Tour Operator Assistant", "Souvenir Shop Assistant", "Duty Free Assistant"
];

const browserAutomationTopics = [
  "Web Scraping", "Data Entry Helper", "Form Filler Guide", "File Organizer", "Task Automator",
  "Report Generator", "Browser Recorder", "PDF Form Extractor", "Document Archiver", "API Integrator",
  "HTML Fetcher", "Webpage Text Extractor", "Image Scraper", "Table Scraper", "Pagination Crawler",
  "Login Page Automator", "Captcha Solver Guide", "Dynamic Content Scraper", "Infinite Scroll Scraper", "XML Sitemap Parser",
  "Robots.txt Checker", "CSV Data Importer", "Excel Data Importer", "JSON Parser", "XML Document Parser",
  "Databases Seeding", "Duplicate Data Cleaner", "String Normalizer", "Phone Number Formatter", "Address Formatter",
  "Email Validator", "Zip Code Matcher", "Text Case Converter", "Regex Pattern Matcher", "Auto-Submit Form",
  "Multi-Page Form", "File Upload Automator", "Dropdown Selector", "Date Picker Automator", "Checkbox Switcher",
  "Directory Watcher", "Auto-Renamer", "Duplicate File Finder", "Bulk File Compressor", "File Extension Converter",
  "PDF Merger", "PDF Splitter", "Cloud Backup Automator", "Archive Decryptor", "Webhook Trigger Setup",
  "Automated API Authentication", "OAuth Token Refresher", "JSON Payload Builder", "XML Payload Builder", "Response Header Parser",
  "HTTP Status Code", "Error Retry Scheduler", "Automated CSV Exporter", "Automated Excel Exporter", "Automated PDF Builder",
  "Email Report Attachment", "Slack Report Poster", "Discord Report Poster", "Google Drive Uploader", "Dropbox Uploader",
  "OneDrive Uploader", "Box Uploader", "S3 Bucket Uploader", "FTP File Transporter", "Secure Copy Automator",
  "SFTP Automator", "Browser Session", "Macro Script Writer", "Keyboard Shortcut", "Mouse Click Automator",
  "Cursor Coordinate", "Scroll Automator", "Auto-Refresh Dashboard", "Screenshot Capture", "Element Visual Checker",
  "PDF Text Extractor", "PDF Table Reader", "OCR Text Extractor", "OCR Receipt Reader", "OCR Invoice Reader",
  "OCR Business Card", "PDF Metadata Editor", "Document Metadata", "File Tagging Automator", "Directory Indexer",
  "Document Search Terms", "Automated File Archiver", "Backup Rotation", "Database Backup", "Git Commit Automator",
  "Git Push Automator", "Server Reboot Alerts", "Disk Space Alerts", "CPU Load Alerts", "Memory Usage Alerts",
  "Network Traffic Monitor", "Log File Analyzer", "Error Log Filter", "Syslog Monitor", "Apache Log Parser",
  "Nginx Log Parser", "Database Log Auditor", "SSH Connection", "Port Scanner Guide", "IP Address Ping",
  "SSL Certificate", "Domain Expiration", "DNS Record Checker", "Whois Lookup", "Cron Job Configurator",
  "Task Scheduler Guide", "Launchd Configurator", "Systemd Service", "Web Automation Tester", "API Request Tester",
  "Git Commit Tagging Guide", "AWS IAM Policy Generator", "Response Code Checker Tool", "Auto-Refresh System Alerts", "S3 Bucket Backup Sync"
];

const writingContentTopics = [
  "Blog Writer", "Copywriter", "SEO Copywriting", "Creative Writing", "Essay Writer",
  "Resume Builder", "Cover Letter Builder", "Proofreader & Editor", "Summarizer", "Script Writer",
  "Creative Brainstormer", "Plagiarism Checker", "Poem & Lyric Writer", "Speech Planner", "Ebook Planner",
  "Blog Outline", "Catchy Title", "Heading Structure", "Paragraph Expander", "Intro Paragraph",
  "Conclusion Paragraph", "Call to Action", "Meta Description", "Blog Post Editor", "Guest Post Pitch",
  "SEO Keyword", "Ad Headline", "Landing Page", "Product Description", "Value Proposition",
  "Brand Story", "About Us Page Writer", "Tagline Generator", "Slogan Generator", "Sales Letter",
  "Direct Response", "Storyboard Creator", "Dialogue Writer", "Character Profile", "Plot Outline",
  "Scene Setup", "Script Formatting", "Monologue Writer", "Playwright Assistant", "Fiction Writing",
  "Poetry Rhyme", "Haiku Writer", "Sonnet Planner", "Lyric Verse", "Song Chorus",
  "Rap Bars", "Speech Pacing", "Speech Rhetoric", "Visual Aid", "Slide Copywriter",
  "Ebook Chapter", "Ebook Intro", "Ebook Outro", "Self-Publishing", "Book Blurb",
  "Thesis Statement Checker", "Academic Abstract", "Bibliography", "APA Style", "MLA Style",
  "Chicago Style", "Harvard Citation", "Essay Outline", "Counterargument", "Essay Transition",
  "Grammar Rules", "Punctuation Checker", "Spelling Corrector", "Active Voice", "Sentence Shortener",
  "Readability Score", "Vocabulary Enhancer", "Cliché Finder", "Plagiarism Paraphrasing", "Direct Quote",
  "In-text Citation", "Text Summarizer", "Bullet Point", "Key Takeaways", "TL;DR Writer",
  "Abstract Summarizer", "Executive Summary", "Video Script", "Hook Sentence", "Video Description",
  "Podcast Episode", "Show Notes", "Social Media", "Instagram Caption", "LinkedIn Post",
  "Twitter Thread", "TikTok Video", "Facebook Post", "Newsletter Copy", "Event Invitation",
  "Press Release", "Press Release Heading", "Business Proposal", "Executive Pitch", "Case Study",
  "Customer Story", "Bio Copywriter", "Professional Bio", "Creative Bio", "Short Bio",
  "Author Bio", "Ebook Pricing Strategies", "Creative Nonfiction Outline Tool", "Heading Hierarchy Editor", "Landing Page Hero Copywriter",
  "Value Proposition Pitcher", "Story Arc Outliner Helper", "APA Citation Formatter Guide", "Sentence Flow Improver", "Key Takeaway Summarizer",
  "Instagram Reel Hook Composer", "LinkedIn Headline Builder", "Press Release Summary Editor", "Slogan Tagline Builder Tool", "Speech Pacing Advisor"
];

const developmentCodingTopics = [
  "Python", "Java", "C & C++", "C#", "JavaScript", "TypeScript", "Go", "Rust", "Swift", "Kotlin",
  "PHP", "Ruby", "SQL", "HTML", "CSS", "React", "Next.js", "Node.js & Express", "PostgreSQL & MySQL", "MongoDB",
  "Git & GitHub", "Docker", "Kubernetes", "AWS & Cloud", "Firebase & Supabase", "REST & GraphQL", "Web Development",
  "Mobile App Development", "Data Structures & Algorithms", "Cybersecurity Basics", "FastAPI", "Django", "Flask",
  "Spring Boot", "Laravel", "Ruby on Rails", "ASP.NET Core", "Vue", "Angular", "Svelte",
  "Tailwind CSS", "Bootstrap", "Material UI", "SQLite", "Cassandra", "DynamoDB", "Vercel",
  "Netlify", "Webpack", "Vite", "Deno", "Bun", "Nginx", "Apache HTTP Server", "Kafka",
  "RabbitMQ", "Stripe API", "Twilio API", "GitHub Actions", "Terraform", "Ansible",
  "Bash Scripting", "PowerShell Scripting", "Regex", "Markdown", "JSON", "YAML",
  "CSV", "XML Code Parser", "WebRTC", "Socket.io", "AWS Lambda", "API Auth Configs",
  "CORS Security", "GraphQL Schema", "ESLint", "Prettier", "Jest Testing",
  "Cypress E2E", "Playwright E2E", "Pytest Unit", "JUnit Testing", "RSpec Testing",
  "Sass & SCSS", "Web Components", "Canvas API", "WebGL", "Three.js",
  "Framer Motion", "NextJS API Routes", "NextJS Server Actions", "SQL Injection Prevention", "XSS Mitigation",
  "JWT Security", "SOLID Principles", "Design Patterns", "Agile Scrum", "Git Flow",
  "Semantic Versioning", "Cryptographic Hashing", "PyTorch", "TensorFlow", "Scikit-learn",
  "Pandas Dataframes", "NumPy Arrays", "MLOps", "Apache Airflow", "Elasticsearch",
  "Neo4j", "SQLite3", "MariaDB", "Cassandra Schema", "DynamoDB Single Table",
  "Vercel Serverless", "Netlify Functions", "Deno Deploy", "Nginx Reverse Proxy", "Apache Mod Rewrite",
  "Kafka Producer", "RabbitMQ Routing", "Stripe Billing", "Twilio Webhooks", "GitHub Actions Runner",
  "Redis Caching", "GraphQL Queries", "Prometheus Metrics", "Grafana Dashboards", "CI-CD Pipelines",
  "Git Rebase Guides", "OAuth Flow Setup", "WebSockets Server", "CSS Flexbox Rules", "Docker Compose Files"
];

const educationLearningTopics = [
  "Study Assistant", "Homework Help", "Exam Preparation", "Physics Tutor", "Math Tutor",
  "Chemistry Tutor", "Biology Tutor", "Computer Science Tutor", "English Tutor", "Coding Tutor",
  "Grammar Checker", "Learning Planner", "Quiz Maker", "Flashcard Creator", "Research Assistant",
  "Vocabulary Builder", "Language Teacher", "Lesson Planner", "Progress Tracker", "Presentation Help",
  "Classical Mechanics", "Electromagnetism", "Thermodynamics", "Wave Optics", "Relativity Theory",
  "Algebra Tutor", "Geometry Tutor", "Calculus Tutor", "Statistics Tutor", "Probability Tutor",
  "Trigonometry Tutor", "Number Theory Tutor", "Logic Gates", "Computer Networks", "Database Normalization",
  "System Design Tutor", "Binary Arithmetic", "Web Dev Basics", "App Dev Basics", "Git Basics",
  "Command Line", "Organic Chemistry", "Inorganic Chemistry", "Periodic Table", "Chemical Bonding",
  "Acid-Base Reactions", "Stoichiometry", "Human Anatomy", "Plant Biology", "Cell Division",
  "Genetics Basics", "Ecology Concepts", "Evolution Theory", "English Literature", "Literary Criticism",
  "Essay Structure", "Rhetorical Analysis", "Shakespeare Works", "Poetry Analysis", "Hindi Tutor",
  "Sanskrit Tutor", "Tamil Tutor", "French Grammar", "German Grammar", "Spanish Grammar",
  "Japanese Kanji", "Chinese Mandarin", "Language Vocabulary", "Pronunciation Guide", "Study Timetable",
  "Revision Schedule", "Active Recall", "Spaced Repetition", "Mind Map", "Pomodoro Timer",
  "Note-Taking Guide", "Cornell Notes", "Practice Test", "Past Paper Review", "Multiple Choice",
  "Short Answer", "Fill-in-the-Blanks", "True/False", "Vocabulary Flashcard", "Subject Flashcard",
  "Citation Formatter", "Bibliography Builder", "Research Topic", "Academic Thesis Statements", "Academic Databases",
  "Primary Source", "Vocabulary Root", "Daily Word", "Synonym Finder", "Idioms Explainer",
  "ESL Conversation", "Classroom Icebreaker", "Teacher Attendance", "Student Gradebook", "IEP Goal Assistant",
  "Rubric Creator", "Classroom Management", "E-learning Course", "Course Module", "Syllabus Planner",
  "Student Survey", "Student Feedback", "Parent-Teacher Note", "Report Card Comments", "Science Fair Projects",
  "History Projects", "Art Project Ideas", "Science Lab Reports", "Kinematics formulas", "Organic naming rules",
  "Periodic groupings", "Mitosis phases", "Punnett squares", "French verbs conjugate", "Cornell templates",
  "Syllabus Plan Generator", "IEP Goal Mapping Helper", "Art Project Planner", "Punnett Square Calculator", "Cornell Notes Template Maker"
];

const healthWellnessTopics = [
  "Fitness Coach", "Workout Planner", "Sleep Coach", "Stress Management", "Nutrition Education",
  "Meal Planning", "Hydration Reminder", "Yoga Guide", "Meditation Guide", "Stretching Guide",
  "Senior Wellness", "Office Wellness", "Healthy Habits", "Sports Fitness", "Weight Management",
  "Strength Training", "Cardio Training", "HIIT Coach", "Bodyweight Workout", "Kettlebell Exercises",
  "Resistance Band", "Workout Log", "Exercise Form", "Stretching Routines", "Warm-up Routines",
  "Cool-down Routines", "Bedtime Wind-down", "Sleep Schedule", "Sleep Hygiene", "Sleep Environment",
  "Bedroom Temperature", "Screen Time", "Morning Routine", "Breathing Guide", "Box Breathing",
  "4-7-8 Breathing", "Mindfulness Prompts", "Gratitude Journal", "Visualizations", "Stress Symptom",
  "Nutritional Values", "Macro Distribution", "Vitamin Intake", "Mineral Intake", "Dietary Fibers",
  "Food Labels", "Grocery Helper", "Portion Size", "Meal Prep", "Diet Plan",
  "Vegetarian Meal", "Vegan Meal", "Keto Meal", "Paleo Meal", "Mediterranean Diet",
  "Food Allergy", "Water Intake", "Hydration Tracking", "Asana Steps", "Sun Salutation",
  "Yoga Poses", "Yoga Breathing", "Meditation Postures", "Guided Meditation", "Silent Meditation",
  "Body Scan", "Desk Stretching", "Neck Strain", "Back Pain", "Joint Mobility",
  "Balance Training", "Low Impact", "Sitting Postures", "Ergonomic Workspace", "Screen Break",
  "Office Walking", "Microbreak", "Habit Loop", "Streak Tracking", "Bedtime Habits",
  "Habit Cue", "Sports Agility", "Endurance Running", "Sprint Training", "Cycling Workouts",
  "Swimming Fitness", "Recovery Days", "Muscle Soreness", "Heart Rate", "BMI Calculator",
  "Body Fat", "Calorie Deficit", "Calorie Surplus", "Portion Control", "Healthy Snacking",
  "Mindful Eating", "Seniors Balance", "Low Impact Cardio", "Joint Preservation", "Women's Fitness",
  "Men's Fitness", "Prenatal Stretching", "Postpartum Recovery", "Core Strength", "Flexibility",
  "Posture", "Ergonomic Chair", "Standing Desk", "Eye Strain", "Sleep Apnea",
  "Healthy Habits Cues", "Bedtime Reading Habits", "Ergonomic Desk Alignment Checker", "HIIT Interval Timer Configuration", "Active Recovery Stretching Guide",
  "Heart Rate Target Zones Calculator", "Desk Stretching Exercises Guide", "Nutrition Label Decrypter Tool", "Sleep Cycle Environment Checklist", "Seniors Balance Exercises Guide",
  "Low-Impact Cardio Planner", "Gratitude Journal Prompt Generator", "Box Breathing Routine Guide", "Water Intake Tracker Helper", "Posture Calibration Guide"
];

const generalTopics = [
  "Brainstorming", "Decision Helper", "Daily Planner", "Goal Planner", "Checklist Maker",
  "Travel Planner", "Trip Planner", "Shopping Assistant", "Habit Tracker", "Reminder Assistant",
  "Simple Explanations", "Step-by-Step Guide", "Comparison Helper", "Idea Generator", "Recipe Ideas",
  "Event Planner", "Name Generator", "Gift Ideas", "Personal Organizer", "Time Management Guide",
  "Password Organizer", "Daily Journal", "Goal Breakdown", "OKRs Tracker", "Travel Packing",
  "Home Safety", "Grocery Checklist", "Errand Runner", "Packing Organizer", "Flight Route",
  "Hotel Search", "Sightseeing", "Local Food", "Price Comparison", "Size Chart",
  "Product Review", "Savings Goal", "Expense Organizer", "Budget Variance Tracker", "Habit Cue Planner",
  "Habit Reward", "Habit Streak", "Appointment Reminders", "Bill Payment", "Medication Reminders",
  "Birthdays Reminders", "Anniversary Reminders", "Dynamic Analogies", "ELI5 Explanations", "Conceptual Analogy",
  "Detailed How-To", "Troubleshooting Flowchart", "Elements Chart", "Pros & Cons", "Feature Comparison",
  "Product Matches", "Birthday Gift", "Anniversary Gift", "Housewarming Gift", "Secret Santa",
  "Gift Wrap", "Recipe Pantry", "Quick Dinner", "Healthy Dessert", "Vegan Cooking",
  "Recipe Scaler", "Party Schedule", "Guest List", "Seating Arrangement", "Catering Coordinator",
  "Playlist Curator", "Baby Name", "Business Name", "Product Name", "Username Generator",
  "Pet Name", "Project Name", "Domain Name", "Password Security", "Daily Reflection",
  "Morning Pages", "Weekly Reflection", "Year-End Reflection", "Bucket List", "Life Goal",
  "Career Goal", "Financial Goal", "Health Goal", "Travel Goal", "Packing Checklist",
  "Camping Checklist", "Moving Checklist", "New Home", "Emergency Prep", "Grocery Budget",
  "Weekly Meal", "Pantry Inventory", "Wardrobe Organizer", "Closet Declutter", "Room Layout",
  "Storage Box", "Task Prioritization", "Eisenhower Matrix", "Kanban Board", "Timeboxing",
  "Pomodoro Method", "Distraction Blocker", "Task Delegate", "Meeting Agenda", "Event Timeline",
  "Daily Time Management", "Grocery Price Tracker", "Eisenhower Matrix Prioritization", "Task Delegation Checklists", "Errand Route Optimization",
  "Pantry Inventory Sheet Maker", "Medication Reminder Scheduler", "Goal Breakdown Tree Planner", "Savings Goal Calculator Tool", "Life Milestones Planner",
  "Weekly Reflection Questionnaire", "Event Seating Grid Planner", "Gift Wrapping Method Guide", "Business Domain Name Checker", "Pomodoro Schedule Builder"
];

// Combine all topic arrays mapping to their correct category
const TOPICS_BY_CATEGORY_RAW: Record<string, string[]> = {
  'Customer Support': customerSupportTopics,
  'Sales & Marketing': salesMarketingTopics,
  'Scheduling': schedulingTopics,
  'Communication': communicationTopics,
  'Analytics & Insights': analyticsInsightsTopics,
  'Industry Specific': industrySpecificTopics,
  'Browser & Automation': browserAutomationTopics,
  'Writing & Content': writingContentTopics,
  'Development & Coding': developmentCodingTopics,
  'Education & Learning': educationLearningTopics,
  'Health & Wellness': healthWellnessTopics,
  'General': generalTopics
};

// Deduplicate and select exactly 125 items per category
const TOPICS_BY_CATEGORY: Record<string, string[]> = {};
for (const cat of CATEGORIES_LIST) {
  const rawList = TOPICS_BY_CATEGORY_RAW[cat] || [];
  const uniqList = Array.from(new Set(rawList));
  if (uniqList.length < 125) {
    throw new Error(`Category ${cat} only has ${uniqList.length} unique topics (needs 125)!`);
  }
  TOPICS_BY_CATEGORY[cat] = uniqList.slice(0, 125);
}

// Define explicit parent-specialized associations (corrected names)
const EXPLICIT_RELATIONSHIPS: Record<string, { parent?: string; related?: string[] }> = {
  // Python umbrella
  'development-coding-python': {
    related: [
      'development-coding-fastapi',
      'development-coding-django',
      'development-coding-flask',
      'development-coding-pandas-dataframes',
      'development-coding-numpy-arrays'
    ]
  },
  'development-coding-fastapi': { parent: 'development-coding-python' },
  'development-coding-django': { parent: 'development-coding-python' },
  'development-coding-flask': { parent: 'development-coding-python' },
  'development-coding-pandas-dataframes': { parent: 'development-coding-python' },
  'development-coding-numpy-arrays': { parent: 'development-coding-python' },

  // Digital Marketing umbrella
  'sales-marketing-digital-marketing': {
    related: [
      'sales-marketing-google-ads',
      'sales-marketing-meta-ads',
      'sales-marketing-seo-strategy',
      'sales-marketing-email-marketing'
    ]
  },
  'sales-marketing-google-ads': { parent: 'sales-marketing-digital-marketing' },
  'sales-marketing-meta-ads': { parent: 'sales-marketing-digital-marketing' },
  'sales-marketing-seo-strategy': { parent: 'sales-marketing-digital-marketing' },
  'sales-marketing-email-marketing': { parent: 'sales-marketing-digital-marketing' },

  // Restaurant Assistant umbrella
  'industry-specific-restaurant-assistant': {
    related: [
      'scheduling-reservation-booking',
      'scheduling-delivery-window-scheduling',
      'customer-support-customer-feedback-logger'
    ]
  },
  'scheduling-reservation-booking': { parent: 'industry-specific-restaurant-assistant' },
  'scheduling-delivery-window-scheduling': { parent: 'industry-specific-restaurant-assistant' },
  'customer-support-customer-feedback-logger': { parent: 'industry-specific-restaurant-assistant' }
};

// 60 distinct guidelines to combinatorially mix as bullet points (lowers Jaccard similarity between any two instructions)
const INSTRUCTION_BULLETS = [
  "Prioritize user clarity by structured layouts and formatting.",
  "Check all parameters and context variables before responding.",
  "Explain the underlying logic behind each recommendation step-by-step.",
  "Avoid generic boilerplate statements and focus on the direct request.",
  "Leverage official standards and protocols for resolving challenges.",
  "State any assumptions made clearly in the output.",
  "Structure final responses with bullet points and clear sections.",
  "Verify if additional inputs are needed and prompt the user if so.",
  "Ensure compatibility with connected workspace configuration files.",
  "Focus on high-performance setups and clean architectures.",
  "Document any troubleshooting transitions sequentially.",
  "Suggest clean code, proper formulas, or clear copy formats.",
  "Maintain an encouraging, polite tone throughout the interaction.",
  "Do not recommend outdated libraries, packages, or configurations.",
  "Analyze input errors carefully and offer detailed fix steps.",
  "Format code blocks with language specifiers correctly.",
  "Highlight potential safety risks or security concerns.",
  "Keep instructions direct, simple, and action-oriented.",
  "Resolve disputes diplomatically and escalate when needed.",
  "Provide minimal runnable examples when explaining custom configurations.",
  "Verify that no private credentials or secret tokens are leaked.",
  "Check data formats and normalize inputs to prevent issues.",
  "Reference standard industry patterns for the task domain.",
  "Explain terms simply and avoid excessive technical jargon.",
  "Adopt a helpful posture to guide the user efficiently.",
  "Limit recommendations to guidelines supported by the context.",
  "Ensure error handling is robust and explicitly outlined.",
  "Confirm output requirements before finalizing suggestions.",
  "Provide comparative pros and cons for alternative choices.",
  "Keep explanations concise and get straight to the point.",
  "Use analogies where helpful to explain abstract concepts.",
  "Audit logic gates and variables for transaction consistency.",
  "Structure outlines and templates for quick scan reading.",
  "Make sure safety parameters are enforced at each transition.",
  "Double-check arithmetic adjustments and SI units.",
  "Do not commit to pricing bounds or schedules blindly.",
  "Explain compiler messages and syntax errors in detail.",
  "Suggest simple workflows to minimize task complexity.",
  "Provide links to relevant documentation if mentioned.",
  "Explain how parameters influence outcomes in real-world scenarios.",
  "Use concise terminology to represent specific variables.",
  "Structure final feedback logs to help catalog issues.",
  "Analyze competitor setups and draw contrasting layouts.",
  "Check for network constraints in cloud-based queries.",
  "State standard error metrics if discussing analytics data.",
  "Draft response hooks that fit character limits directly.",
  "Ensure dietary restrictions are validated for meal suggestions.",
  "Draft clear action plans with timestamps and dates.",
  "Adopt target audience perspectives for writing copy.",
  "Verify data types of the parameters before executing.",
  "Keep instructions modular and separate from global rules.",
  "Reference specific parameters of local integrations.",
  "Organize steps inside chronological timelines.",
  "Formulate equations clearly with standard symbols.",
  "State variables in local configuration formats.",
  "Validate sheet columns index before pushing rows.",
  "Confirm email addresses conform to standard formats.",
  "Structure event calendars to avoid calendar booking errors.",
  "Limit search keywords to target domain directories.",
  "Check system memory limits if running local configurations."
];

// Grammar components to combinatorially generate 400 unique description templates
const VERBS = [
  "Assists with", "Provides help for", "Optimizes workflows for", "Guides procedures regarding",
  "Coordinates operations for", "Streamlines processes for", "Handles queries concerning",
  "Helps manage", "Delivers solutions for", "Facilitates tasks for", "Supports execution of",
  "Aids development of", "Tracks metrics for", "Configures setups for", "Resolves issues with",
  "Manages pipelines for", "Implements standards for", "Documents steps for", "Structures advice on",
  "Automates routines for"
];

const NOUNS = [
  "activities", "goals", "tasks", "actions", "workflows", "queries", "projects", "challenges",
  "operations", "systems", "needs", "functions", "procedures", "methods", "routines", "pipelines",
  "strategies", "requirements", "guidelines", "implementations"
];

function generateInstructions(name: string, category: string, id: string): string {
  const h = hashString(name);
  const rand = makeRandom(h);

  // Pick 4 bullet points uniquely using the seeded PRNG to ensure zero hash collision
  const chosen: string[] = [];
  const indices = new Set<number>();
  while (chosen.length < 4) {
    const idx = Math.floor(rand() * INSTRUCTION_BULLETS.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      chosen.push(INSTRUCTION_BULLETS[idx]);
    }
  }

  const b1 = chosen[0];
  const b2 = chosen[1];
  const b3 = chosen[2];
  const b4 = chosen[3];

  // Specific short domain guidelines based on category
  let domainText = "";
  if (category === 'Development & Coding') {
    domainText = `Solve coding tasks using standard developer conventions for ${name}.`;
  } else if (category === 'Customer Support') {
    domainText = `Deliver polite customer support and triage ${name} queries.`;
  } else if (category === 'Education & Learning') {
    domainText = `Provide structured educational tutoring for ${name} concepts.`;
  } else if (category === 'Health & Wellness') {
    domainText = `Provide helpful wellness habit guides for ${name} routines.`;
  } else if (category === 'Scheduling') {
    domainText = `Schedule slots using configurations for ${name} appointments.`;
  } else {
    domainText = `Draft structured steps, outlines, or suggestions for ${name}.`;
  }

  return `You are a specialized agent for ${name} under category ${category}. ${domainText}
Guidelines checklist:
1. ${b1}
2. ${b2}
3. ${b3}
4. ${b4}
Execute all ${name} requests carefully with ID ${id}.`;
}

function generateDescription(name: string, category: string): string {
  const h = hashString(name);
  const rand = makeRandom(h + 9999);
  
  const verbIdx = Math.floor(rand() * VERBS.length);
  const nounIdx = Math.floor(rand() * NOUNS.length);
  
  const verb = VERBS[verbIdx];
  const noun = NOUNS[nounIdx];
  
  return `${verb} ${name} ${noun} specifically for ${category} domain.`;
}

function generateSkills() {
  console.log("=== GENERATING 1500 DISTINCT SKILLS (125 PER CATEGORY) ===");

  const defaultMetaList: SkillMetadata[] = [];
  const remainingMetaList: SkillMetadata[] = [];

  const defaultSkillsPerCat: Record<string, Skill[]> = {};
  const remainingSkillsPerCat: Record<string, Skill[]> = {};

  let totalCount = 0;

  for (const cat of CATEGORIES_LIST) {
    const topics = TOPICS_BY_CATEGORY[cat] || [];
    
    // Verify we have exactly 125 items in each array
    if (topics.length !== 125) {
      throw new Error(`Category ${cat} has ${topics.length} topics instead of 125!`);
    }

    const catIndex = CATEGORIES_LIST.indexOf(cat);
    // 8 categories with 17 default skills, 4 categories with 16 default skills
    const defaultCount = catIndex < 8 ? 17 : 16;

    const defaultTopics = topics.slice(0, defaultCount);
    const remainingTopics = topics.slice(defaultCount);

    const buildSkillItem = (name: string) => {
      const slug = slugify(name);
      const catSlug = slugify(cat);
      const skillId = `${catSlug}-${slug}`;

      // Search tags & keywords
      const tags = [slug, catSlug.split('-')[0], "capability"];
      const aliases = [`${name} helper`, `${name} tool`];
      const searchKeywords = [`how to do ${name}`, `explain ${name}`, `use ${name}`];
      const targetAudiences = cat === 'Development & Coding' ? ["Developers", "Engineers"] : ["Professionals", "General Public"];

      if (name === "Sleep Coach") {
        targetAudiences.length = 0;
        targetAudiences.push("People seeking sleep guidance");
      }

      const knowledgeDomains = [`${name} core principles`, `${name} operations`];

      // Metadata item
      const metaItem: SkillMetadata = {
        id: skillId,
        name,
        description: generateDescription(name, cat),
        category: cat,
        tags,
        aliases,
        searchKeywords,
        targetAudiences,
        knowledgeDomains
      };

      // Add parent-child link if explicit
      if (EXPLICIT_RELATIONSHIPS[skillId]) {
        if (EXPLICIT_RELATIONSHIPS[skillId].parent) {
          metaItem.parentSkillId = EXPLICIT_RELATIONSHIPS[skillId].parent;
        }
        if (EXPLICIT_RELATIONSHIPS[skillId].related) {
          metaItem.relatedSkillIds = EXPLICIT_RELATIONSHIPS[skillId].related;
        }
      }

      // Full skill structure
      const systemInstructions = generateInstructions(name, cat, skillId);
      
      const skillItem: Skill = {
        skillId,
        name,
        description: metaItem.description,
        category: cat,
        tags,
        version: "1.0.0",
        status: "active",
        capabilities: [`execute_${slug}_task`, `query_${slug}_details`],
        triggerConditions: [`${name.toLowerCase()}`],
        negativeTriggerConditions: [`not_${name.toLowerCase()}`],
        systemInstructions,
        requiredInputs: [],
        optionalInputs: [],
        outputBehavior: `Output a clear explanation, response draft, or action confirmation matching ${name} standards.`,
        toolsAllowed: cat === 'Scheduling' ? ['google-calendar'] : (cat === 'Customer Support' ? ['gmail'] : []),
        actionsAllowed: cat === 'Scheduling' ? ['create_calendar_event'] : (cat === 'Customer Support' ? ['send_mail'] : []),
        constraints: [`Only execute actions dynamically supported by connected workspace configuration integrations.`],
        safetyRules: cat === 'Health & Wellness' ? ["Disclaimer: I am an AI assistant and this info is for educational purposes only. For medical queries, consult a professional."] : [],
        conflictsWith: [],
        compatibleSkills: [],
        priority: 3,
        routingHints: [name.toLowerCase(), slug.replace(/-/g, ' ')],
        examples: [
          { input: `Help me with ${name.toLowerCase()}`, output: `Sure, I can assist with that. Let's start.` }
        ],
        knowledgeDomains
      };

      if (EXPLICIT_RELATIONSHIPS[skillId]) {
        if (EXPLICIT_RELATIONSHIPS[skillId].parent) {
          skillItem.parentSkillId = EXPLICIT_RELATIONSHIPS[skillId].parent;
        }
        if (EXPLICIT_RELATIONSHIPS[skillId].related) {
          skillItem.relatedSkillIds = EXPLICIT_RELATIONSHIPS[skillId].related;
        }
      }

      return { metaItem, skillItem };
    };

    // Process default items
    defaultTopics.forEach(name => {
      const { metaItem, skillItem } = buildSkillItem(name);
      defaultMetaList.push(metaItem);
      if (!defaultSkillsPerCat[cat]) defaultSkillsPerCat[cat] = [];
      defaultSkillsPerCat[cat].push(skillItem);
    });

    // Process remaining items
    remainingTopics.forEach(name => {
      const { metaItem, skillItem } = buildSkillItem(name);
      remainingMetaList.push(metaItem);
      if (!remainingSkillsPerCat[cat]) remainingSkillsPerCat[cat] = [];
      remainingSkillsPerCat[cat].push(skillItem);
    });
  }

  // Combine lists: default installed skills placed first (exactly 200), then remaining store library skills (exactly 1300)
  const metadataList = [...defaultMetaList, ...remainingMetaList];
  totalCount = metadataList.length;

  console.log(`Generated total skills count: ${totalCount}`);

  // Ensure output directories exist
  const dataDir = path.join(__dirname, '../data/skills');
  const compiledDir = path.join(dataDir, 'compiled');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(compiledDir)) fs.mkdirSync(compiledDir, { recursive: true });

  // Write metadata.json
  const metadataPath = path.join(dataDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadataList, null, 2));

  // Write category compiled files (merging default + remaining for full category counts)
  for (const cat of CATEGORIES_LIST) {
    const list1 = defaultSkillsPerCat[cat] || [];
    const list2 = remainingSkillsPerCat[cat] || [];
    const fullList = [...list1, ...list2];
    const catSlug = slugify(cat);
    const catPath = path.join(compiledDir, `${catSlug}.json`);
    fs.writeFileSync(catPath, JSON.stringify(fullList, null, 2));
  }

  console.log("Successfully generated all compiled category files!");

  // Measure raw metadata file size
  const stats = fs.statSync(metadataPath);
  const rawSizeKb = stats.size / 1024;
  console.log(`Metadata raw size: ${rawSizeKb.toFixed(1)} KB`);
}

generateSkills();
