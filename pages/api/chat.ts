import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Missing message" });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "Server missing GEMINI_API_KEY env var" });
  }

  try {
    const providerUrl = "https://api.openai.com/v1/chat/completions"; // example; replace if using Gemini endpoint
    const openaiResp = await fetch(providerUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: message }], stream: true })
    });

    if (!openaiResp.ok || !openaiResp.body) {
      const txt = await openaiResp.text();
      return res.status(500).json({ error: txt });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const reader = openaiResp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const chunk = decoder.decode(value);
        res.write(chunk);
      }
    }
    res.end();
  } catch (err: any) {
    console.error("Streaming proxy error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
}
