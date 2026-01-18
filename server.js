import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();

// Trust proxy for accurate IP addresses (important for rate limiting behind proxies)
// Set to 3 for Render.com which uses multiple proxy layers
app.set('trust proxy', 3);

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // More restrictive than '*'
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);

// Rate limiter for /ask endpoint
const askRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// test route
app.get("/", (req, res) => {
  res.send("Backend is running fine ✅");
});

app.post("/ask", askRateLimiter, async (req, res) => {
  try {
    const messages = req.body.messages; // [{role: "user"|"assistant", content: "..."}, ...]
    const question = req.body.question;

    // Enhanced validation
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: "Question is required and must be a string" });
    }

    // Limit question length
    if (question.length > 500) {
      return res.status(400).json({ error: "Question is too long. Maximum 500 characters." });
    }

    // Limit messages array size
    if (messages.length > 50) {
      return res.status(400).json({ error: "Too many messages in conversation history." });
    }

    // Validate each message structure
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return res.status(400).json({ error: "Invalid message format" });
      }
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return res.status(400).json({ error: "Invalid message role" });
      }
      if (typeof msg.content !== 'string') {
        return res.status(400).json({ error: "Message content must be a string" });
      }
    }

    // Build messages for OpenAI
    const systemMessage = {
      role: "system",
      content: `
You are Kunal Agarwal's professional assistant chatbot for his portfolio website.
Your main responsibility is to share Kunal's professional background, skills, and experience with potential recruiters and employers.

-----------------------
KUNAL AGARWAL OVERVIEW
-----------------------

EXPERIENCE:

• Activant Solutions (Oct 2024 – Present)
  - Role: Full Stack Developer, Jaipur, Rajasthan
  - Responsibilities:
    - Working on Chataffy, an AI-powered chat support platform for businesses.
    - Developed chatbot training features using web crawling and embeddings for automated responses.
    - Implemented real-time chat with Socket.IO, Next.js, and Node.js.
    - Built customizable chatbot settings and AI-human handoff features.
    - Optimized performance and scalability via code profiling and efficient architecture.

• Code Symphony LLP (May 2023 – Oct 2024)
  - Role: Full Stack Developer, Gujarat, India
  - Responsibilities:
    - Developed backend services for Folklog, a kids’ learning platform using NestJS and MySQL.
    - Integrated TypeORM, New Relic, and Bunny.net CDN for monitoring and fast content delivery.
    - Implemented role-based API management and subscription handling with RevenueCat.
    - Reviewed pull requests to ensure scalability and clean code practices.

• KainSkep Solutions (Sept 2022 – Apr 2023)
  - Role: Node.js Intern, Jaipur, Rajasthan
  - Responsibilities:
    - Contributed to Eximpedia, an analytics tool for Asia’s trade data.
    - Developed REST APIs using Node.js and ElasticSearch for data insights and visualization.

-----------------
TECHNICAL SKILLS:
-----------------
- Languages: JavaScript, TypeScript
- Frontend: React.js, Next.js, HTML, CSS, Tailwind CSS
- Backend: Node.js, NestJS, Express.js
- Databases: MongoDB, MySQL
- Cloud & DevOps: AWS (EC2, S3, Lambda), Docker, Nginx, pm2, Git, GitHub, Vercel
- Other: WebSockets, RESTful APIs, Agile methodologies

---------------
KEY PROJECTS:
---------------

• Chataffy – AI Chat Support System (Professional)
  - Created web scraping and embedding pipelines for chatbot training.
  - Utilized BullMQ for job queues and Pinecone for vector storage.
  - Containerized the application with Docker for scalable deployment.

• Folklog – Kids’ Learning Platform (Professional)
  - Developed backend APIs using NestJS + MySQL.
  - Integrated New Relic and Bunny.net CDN.
  - Added Google Analytics and RevenueCat for tracking and subscription management.

• Freshopure – B2B Fruits & Vegetables Ordering App (Personal)
  - Built APIs for order management and OTP-based authentication using Msg91.
  - Deployed on AWS with JWT-secured access and serverless MongoDB setup.

------------
EDUCATION:
------------
- B.Tech in Computer Science from JECRC University (2019–2023), CGPA: 8.2

-------------
CONTACT:
-------------
- Email: kunalagarwal5614@gmail.com
- Phone: +91 7878682369
- Location: Jaipur, Rajasthan, India
- Open to remote work and relocation

----------------------------------------------------------
INSTRUCTIONS FOR CHATBOT:
----------------------------------------------------------
- Respond in a professional, friendly tone.
- Be concise but informative.
- If asked about something not included above, politely say you don't have that specific information, but offer to provide related details that you do know.
      `,
    };

    // Build the messages array: system message + conversation history + current question
    const promptMessages = [
      systemMessage,
      ...messages.filter(
        (msg) => msg.role === "user" || msg.role === "assistant"
      ), // Include previous conversation
      { role: "user", content: question }, // Add current question
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: promptMessages,
      temperature: 0.7,
      max_tokens: 200,
    });

    const reply = completion.choices[0].message.content;

    console.log("✅ AI Response generated");

    res.json({ answer: reply });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Contact form endpoint
app.post("/contact", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  if (!process.env.RESEND_API_KEY) {
    return res
      .status(500)
      .json({ error: "Email service is not configured" });
  }

  try {
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "Portfolio Contact <onboarding@resend.dev>";

    await resend.emails.send({
      from: fromEmail,
      reply_to: email,
      to: [process.env.CONTACT_TARGET_EMAIL || "kunalagarwal5614@gmail.com"],
      subject: `Portfolio Contact: ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });

    res.json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    console.error("❌ Error sending contact email:", error);
    res
      .status(500)
      .json({ error: "Failed to send message. Please try again later." });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`✅ Server running on http://localhost:${process.env.PORT}`);
});
