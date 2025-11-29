import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { Resend } from "resend";
import OpenAI from "openai";
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
app.use(
  cors({
    origin: '*', // allow your Vite frontend
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(bodyParser.json());

// test route
app.get("/", (req, res) => {
  res.send("Backend is running fine ✅");
});

app.post("/ask", async (req, res) => {
  try {
    const messages = req.body.messages; // [{role: "user"|"assistant", content: "..."}, ...]
    const question = req.body.question;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    // Build messages for OpenAI
    const systemMessage = {
      role: "system",
      content: `You are Kunal Agarwal's professional assistant chatbot on his portfolio website. Your role is to provide information about Kunal's professional background, skills, and experience to potential recruiters and employers.

Key information about Kunal:

EXPERIENCE:
- Full Stack Developer at Activant Solutions (Jun 2024 - Present)
  - Built AI-powered chat support platform (Chataffy)
  - Developed video streaming features using WebSockets
  - Integrated WhatsApp Business API
  
- Full Stack Developer at Code Symphony LLP (Oct 2023 - May 2024)
  - Built kids' learning platform (Folklog) with 1000+ active users
  - Implemented payment gateway and real-time features
  
- Software Developer at KainSkep Solutions (Sep 2022 - Sep 2023)
  - Built B2B ordering app (Freshopure) with MongoDB/Express.js/React
  - Reduced load times by 40%

SKILLS:
- Languages: JavaScript, TypeScript
- Frontend: React.js, Next.js, HTML, CSS, Tailwind CSS
- Backend: Node.js, NestJS, Express.js
- Databases: MongoDB, MySQL, PostgreSQL
- Cloud & DevOps: AWS (EC2, S3, Lambda), Docker, Nginx
- Other: WebSockets, RESTful APIs, Agile methodologies

KEY PROJECTS:
1. Chataffy - AI-powered customer support with multilingual chat, ticket system
2. Folklog - Educational platform with 1000+ users, gamification features
3. Freshopure - B2B ordering app with real-time tracking

EDUCATION:
- B.Tech in Computer Science from JECRC University (2019-2023), CGPA: 8.2

CONTACT:
- Email: kunalagarwal5614@gmail.com
- Phone: +91 7878682369
- Location: Jaipur, Rajasthan, India
- Open to remote work and relocation

Respond in a professional, friendly tone. Be concise but informative. If asked about something not in the information above, politely say you don't have that specific information but offer to provide related details that you do know.`,
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
      max_tokens: 300,
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
