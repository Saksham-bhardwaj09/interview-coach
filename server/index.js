require("dotenv").config();
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM = `You are a strict but friendly technical interviewer.
Ask ONE question at a time. After the candidate answers, ask a relevant follow-up.
Keep replies under 80 words.`;

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: { systemInstruction: SYSTEM },
    });
    res.json({ reply: response.text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const SCORE_PROMPT = `You are an interview evaluator.
Score the candidate's answer from 1 to 10 on:
- clarity: how clear and well structured it is
- correctness: how technically correct it is
- confidence: how confident and direct it sounds
Return ONLY JSON in this format:
{"clarity": 0, "correctness": 0, "confidence": 0, "feedback": "one short tip"}`;

app.post("/api/score", async (req, res) => {
  try {
    const { question, answer } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: `Question: ${question}\n\nCandidate answer: ${answer}` }],
        },
      ],
      config: {
        systemInstruction: SCORE_PROMPT,
        responseMimeType: "application/json",
      },
    });
    res.json(JSON.parse(response.text));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const FILE = "sessions.json";

function readData() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

app.post("/api/save", (req, res) => {
  const data = readData();
  data.push({ ...req.body, date: new Date().toISOString() });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  res.json({ ok: true });
});

app.get("/api/history", (req, res) => {
  res.json(readData());
});

app.listen(5000, () => console.log("Server running on 5000"));