import * as fs from 'fs';
import * as path from 'path';

const CATEGORIES = [
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
];

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
  "Technical Documentation Linker", "Hardware Return Intake", "Software License Recovery", "Account Lockout Advisor", "Customer Survey Builder",
  "Feedback Surveys Builder", "Shipping Policy Explainer", "Customer Ticket Priority Sorter", "Technical Guides Linker", "GDPR Deletion Processing"
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
  "HubSpot CRM Guide", "Customer Journeys Guide", "Sales Objections Guide", "Closing Objections Guide", "Price Negotiation Guide",
  "Sales Forecasting Guide", "Sales Quotas Tracker", "Compensation Plans Guide", "Sales Coaching Guide", "Outbound Sales Guide"
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
  "Late Cancellation Grids", "No-Show Logs Tracker", "On-Call Schedules Roster", "Maternity Leave Timelines", "AGM Planners Logs"
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
  "Interactive Chat Guidelines Setup", "Crisis Communication Planner Guide", "PR Campaign Advisor", "Professional Intro Messages"
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
  "RFM Analysis", "Market Share", "Industry Trend", "Demographics Analysis", "Geographic Sales",
  "Feedback Text Mining", "Sentiment Analysis", "Word Cloud Generator", "Survey Response", "Quiz Completion",
  "E-learning Student", "Course Enrollment", "Drop-out Risk", "Fitness Progress", "Weight Goal Metrics",
  "Calorie Intake", "Sleep Quality", "Stress Level", "Time-Tracking Analytics", "Screen Time Audits",
  "Personal Budget", "Savings Rate", "Net Worth Calculator", "Investment Portfolio", "Real Estate Value",
  "Property Rental Yield"
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
  "Counselor Assistant", "Travel Guide Assistant", "Tour Operator Assistant", "Souvenir Shop Assistant", "Duty Free Assistant",
  "Airport Shuttle Assistant", "Taxi Service Assistant", "Scooter Share Assistant", "Car Wash Assistant", "Roofing Service Estimate",
  "Moving Company Crews", "Storage Facility Units", "Courier Service Pickups", "Law Firm Consultations", "Accounting Firm Audits",
  "Tax Advisor Filings", "Financial Planner Budgets", "Insurance Broker Quotes", "Bank Branch ATMs", "Credit Union Loans",
  "Mortgage Broker Rates", "Recruitment Agency Screenings", "Staffing Agency Temp Roster", "HR Consultant Manuals", "PR Agency Releases",
  "SEO Consultant Crawls", "Web Design Mockups", "App Development Endpoints", "Dropshipping Orders", "Subscription Box Contents",
  "Pet Grooming Grids", "Dog Walking Routes", "Pet Boarding Kennels", "Vet Clinic Appointments", "Animal Shelter Adoptions",
  "Farm Crop Rotation", "Winery Tasting Room", "Brewery Fermentation", "Distillery Spirits", "Juice Bar Blends",
  "Food Truck Map", "Catering Banquet", "Ice Cream Toppings", "Pizzeria Delivery", "Sushi Omakase",
  "Steakhouse Seating", "Vegetarian Ingredients", "Vegan Cafe Events", "Seafood Supplier Prices", "Fast Food Promos"
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
  "Task Scheduler Guide", "Launchd Configurator", "Systemd Service", "Web Automation Tester", "API Request Tester"
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
  "Author Bio", "Ebook Pricing Strategies"
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
  "Terraform Workspace", "Ansible Playbook", "Bash Loops", "PowerShell Pipelines", "Regex Captures",
  "Markdown Tables", "JSON Schemas", "YAML Anchors", "CSV Parser", "XML Parser",
  "WebRTC Peer", "Socket.io Client", "AWS Lambda Setup", "API JWT Auth", "CORS Config",
  "GraphQL Resolvers", "ESLint Rules", "Prettier Formatting", "Jest Mocks", "Cypress Selectors",
  "Playwright Context", "Pytest Fixtures", "JUnit Mocks", "RSpec Mocks", "Sass Variables",
  "Shadow DOM", "Canvas Render", "WebGL Shader", "Three.js Geometries", "Framer Motion Animate",
  "NextJS Dynamic Routes", "NextJS Server Cache", "SQL Injections Prevention", "XSS CSP Header", "JWT Key Rotation",
  "Database Indexing Optimization", "JSON-LD Schema Markup"
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
  "Periodic groupings", "Mitosis phases", "Punnett squares", "French verbs conjugate", "Cornell templates"
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
  "Healthy Habits Cues", "Bedtime Reading Habits"
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
  "Daily Time Management", "Grocery Price Tracker"
];

function checkAudits() {
  console.log("=== COMPILING AND AUDITING SKILL NAME INVENTORY ===");

  const lists: Record<string, string[]> = {
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

  let totalCount = 0;
  const nameToCategory = new Map<string, string>();
  const idToName = new Map<string, string>();
  const duplicates: string[] = [];
  const normalizedDuplicates: string[] = [];
  const suffixCheckMatches: string[] = [];

  const invalidSuffixes = [
    "Intake & Sorting", "Diagnostics & Troubleshooting", "Information Updates",
    "Policy Walkthrough", "Status Verification", "Conflict Resolution",
    "Action Execution", "Quality Feedback Loop", "Quick FAQ Reference", "Handoff Coordinator"
  ];

  for (const cat of CATEGORIES) {
    const list = lists[cat] || [];
    totalCount += list.length;
    console.log(`  - Category '${cat}': ${list.length} skills`);

    for (const name of list) {
      const lower = name.toLowerCase().trim();
      const norm = lower.replace(/[^a-z0-9]+/g, '');

      // Check duplicate exact names
      if (nameToCategory.has(lower)) {
        duplicates.push(`${name} (already in '${nameToCategory.get(lower)}')`);
      }
      nameToCategory.set(lower, cat);

      // Check duplicate normalized names
      if (idToName.has(norm)) {
        normalizedDuplicates.push(`${name} normalized to ${norm} matches ${idToName.get(norm)}`);
      }
      idToName.set(norm, name);

      // Check suffixes
      for (const suf of invalidSuffixes) {
        if (name.includes(suf)) {
          suffixCheckMatches.push(`${name} contains invalid suffix: ${suf}`);
        }
      }
    }
  }

  console.log(`\nTotal Skill Count compiled: ${totalCount}`);
  console.log(`Duplicate exact names found: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log("Duplicates: ", duplicates.slice(0, 10));
  }

  console.log(`Duplicate normalized names found: ${normalizedDuplicates.length}`);
  if (normalizedDuplicates.length > 0) {
    console.log("Normalized Duplicates: ", normalizedDuplicates.slice(0, 10));
  }

  console.log(`Invalid Suffix occurrences found: ${suffixCheckMatches.length}`);
  if (suffixCheckMatches.length > 0) {
    console.log("Suffix failures: ", suffixCheckMatches.slice(0, 10));
  }

  // Calculate Jaccard on names to check semantic closeness of names
  let closeNamePairsCount = 0;
  const tokenised = CATEGORIES.flatMap(cat => (lists[cat] || []).map(name => ({
    name,
    set: new Set(name.toLowerCase().split(/\s+/).filter(w => w.length > 2))
  })));

  for (let i = 0; i < tokenised.length; i++) {
    for (let j = i + 1; j < tokenised.length; j++) {
      const t1 = tokenised[i];
      const t2 = tokenised[j];
      if (t1.set.size === 0 || t2.set.size === 0) continue;
      
      let intersectionSize = 0;
      for (const x of t1.set) {
        if (t2.set.has(x)) intersectionSize++;
      }
      const unionSize = t1.set.size + t2.set.size - intersectionSize;
      const sim = intersectionSize / unionSize;

      if (sim > 0.85) {
        closeNamePairsCount++;
      }
    }
  }
  console.log(`Close word-based name similarities (>85%): ${closeNamePairsCount}`);

  // Write inventory markdown
  let inventoryMd = "# Dudo Consolidated 1500 Skill Inventory\n\n";
  for (const cat of CATEGORIES) {
    inventoryMd += `## ${cat} (${(lists[cat] || []).length} skills)\n\n`;
    (lists[cat] || []).forEach((name, i) => {
      inventoryMd += `${i + 1}. **${name}**\n`;
    });
    inventoryMd += "\n";
  }

  // Save to the artifacts folder
  const artifactsPath = "C:\\Users\\Kishore\\.gemini\\antigravity-ide\\brain\\dd013670-9f13-44d6-ac67-9e6946ee81bd\\skill_catalog_inventory.md";
  fs.writeFileSync(
    artifactsPath,
    inventoryMd
  );
  console.log(`\nSaved audited inventory to ${artifactsPath}!`);
}

checkAudits();
