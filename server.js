const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL && ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"].includes(process.env.GROQ_MODEL)
  ? process.env.GROQ_MODEL
  : "openai/gpt-oss-120b";
const MODELS = [
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", description: "Best overall quality" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", description: "Faster responses" },
  { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", description: "Reasoning and multimodal model" }
];
const MODEL_IDS = new Set(MODELS.map(model => model.id));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: "Groq", configured: Boolean(process.env.GROQ_API_KEY), model: DEFAULT_MODEL });
});

app.get("/api/models", (_req, res) => res.json({ models: MODELS, defaultModel: DEFAULT_MODEL }));

app.post("/api/chat", async (req, res) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: "Groq API key is not configured. Add GROQ_API_KEY to your .env file." });

  const body = req.body || {};
  const incoming = body.messages;
  if (!Array.isArray(incoming) || incoming.length === 0 || incoming.length > 80) {
    return res.status(400).json({ error: "Please send a valid conversation." });
  }

  const model = typeof body.model === "string" && MODEL_IDS.has(body.model) ? body.model : DEFAULT_MODEL;
  const personalities = {
    balanced: "Be friendly, thoughtful, clear, and naturally conversational.",
    concise: "Be concise and direct. Prefer short, useful answers without unnecessary filler.",
    creative: "Be imaginative and curious. Offer original ideas while staying accurate.",
    tutor: "Act as a patient tutor. Explain ideas step by step, use examples, and encourage learning without simply doing all the thinking for the learner.",
    professional: "Use a polished, professional tone. Be structured, precise, and practical."
  };
  const personality = personalities[body.personality] || personalities.balanced;
  const customInstructions = typeof body.customInstructions === "string" ? body.customInstructions.slice(0, 1800).trim() : "";
  const memory = typeof body.memory === "string" ? body.memory.slice(0, 3000).trim() : "";

  const systemParts = [
    "You are Luma, a helpful AI assistant. Be accurate, respectful, and age-appropriate. Use Markdown when it improves readability.",
    `Personality: ${personality}`,
    customInstructions ? `Additional user preferences for your style: ${customInstructions}` : "",
    memory ? `User-provided memory and preferences (use only when relevant):\n${memory}` : ""
  ].filter(Boolean);

  const safeMessages = incoming
    .filter(m => m && ["user", "assistant"].includes(m.role))
    .map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content.slice(0, 20000) : "" }))
    .filter(m => m.content);

  if (!safeMessages.length) return res.status(400).json({ error: "Your conversation is empty." });

  try {
    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemParts.join("\n\n") }, ...safeMessages],
        stream: true,
        temperature: 0.7,
        max_tokens: 1800
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return res.status(upstream.status).json({ error: `Groq returned ${upstream.status}. ${detail.slice(0, 700)}` });
    }
    if (!upstream.body) return res.status(502).json({ error: "Groq returned an empty response." });

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done || res.destroyed) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      const tail = decoder.decode();
      if (tail && !res.destroyed) res.write(tail);
    } finally {
      if (!res.destroyed) res.end();
      reader.releaseLock();
    }
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: "Could not reach Groq. Check your connection and server logs." });
    else if (!res.destroyed) res.end();
    console.error("Luma chat error:", err.message);
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Luma is running at http://localhost:${port}`));
