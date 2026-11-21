import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

const API = "http://localhost:5000/api";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [scores, setScores] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  async function loadHistory() {
    try {
      const r = await fetch(`${API}/history`);
      setHistory(await r.json());
    } catch (e) {
      console.log("History failed:", e);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  function speak(text) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\*/g, ""));
    window.speechSynthesis.speak(u);
  }

  function listen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input needs Chrome or Edge");
      return;
    }
    window.speechSynthesis.cancel();
    const rec = new SR();
    rec.lang = "en-US";
    rec.onresult = (e) => setInput(e.results[0][0].transcript);
    rec.start();
  }

  async function send(text) {
    const lastQuestion = [...messages]
      .reverse()
      .find((m) => m.role === "assistant")?.content;

    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      setMessages([...updated, { role: "assistant", content: data.reply || data.error }]);
      if (data.reply) speak(data.reply);

      if (lastQuestion && !lastQuestion.startsWith("Server error")) {
        try {
          const s = await fetch(`${API}/score`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: lastQuestion, answer: text }),
          });
          const score = await s.json();
          if (!score.error) {
            setScores((prev) => [...prev, { answer: text, ...score }]);
            await fetch(`${API}/save`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question: lastQuestion, answer: text, ...score }),
            });
            loadHistory();
          } else {
            console.log("Score error:", score.error);
          }
        } catch (e) {
          console.log("Scoring failed:", e);
        }
      }
    } catch (e) {
      setMessages([...updated, { role: "assistant", content: "Server error" }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 600, margin: "20px auto", fontFamily: "sans-serif" }}>
      <h2>AI Interview Coach</h2>
      <button onClick={() => send("Start a DSA interview for me.")}>Start Interview</button>

      <div style={{ margin: "16px 0" }}>
        {messages.map((m, i) => (
          <p key={i}>
            <b>{m.role === "user" ? "You" : "Interviewer"}:</b> {m.content}
          </p>
        ))}
        {loading && <p>Thinking...</p>}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type your answer"
        style={{ width: "60%" }}
      />
      <button onClick={listen}>🎤 Speak</button>
      <button onClick={() => input && send(input)}>Send</button>

      <h3>Your Scores</h3>
      {scores.map((s, i) => (
        <div key={i} style={{ border: "1px solid #ccc", padding: 8, marginBottom: 8 }}>
          <div>Clarity: {s.clarity}/10</div>
          <div>Correctness: {s.correctness}/10</div>
          <div>Confidence: {s.confidence}/10</div>
          <div><i>{s.feedback}</i></div>
        </div>
      ))}
      <h3>Progress Over Time</h3>
      <LineChart
        width={560}
        height={250}
        data={history.map((h, i) => ({ n: i + 1, ...h }))}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="n" />
        <YAxis domain={[0, 10]} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="clarity" stroke="#8884d8" />
        <Line type="monotone" dataKey="correctness" stroke="#82ca9d" />
        <Line type="monotone" dataKey="confidence" stroke="#ff7300" />
      </LineChart>
    </div>
  );
}