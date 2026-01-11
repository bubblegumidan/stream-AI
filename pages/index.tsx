import { useState, useRef } from "react";

type Message = { role: "user" | "assistant"; text: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", text: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsStreaming(true);

    controllerRef.current?.abort();
    const ac = new AbortController();
    controllerRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.text }),
        signal: ac.signal
      });

      if (!res.ok) {
        const txt = await res.text();
        setMessages((m) => [...m, { role: "assistant", text: `Error: ${txt}` }]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantText = "";
      setMessages((m) => [...m, { role: "assistant", text: "" }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          assistantText += chunk;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", text: assistantText };
            return copy;
          });
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((m) => [...m, { role: "assistant", text: `Error: ${err.message}` }]);
      }
    } finally {
      setIsStreaming(false);
      controllerRef.current = null;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b border-gray-800">
        <h1 className="text-2xl font-semibold">stream-AI</h1>
        <p className="text-sm text-gray-400">Free • No sign-in • Black theme</p>
      </header>

      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div className={(m.role === "user" ? "inline-block bg-gray-800 text-white" : "inline-block bg-gradient-to-r from-purple-700 to-indigo-600 text-white") + " px-4 py-2 rounded-lg max-w-[80%] break-words"}>
                {m.text || (m.role === "assistant" && <span className="opacity-60">...</span>)}
              </div>
            </div>
          ))}
        </div>
      </main>

      <form onSubmit={handleSend} className="p-4 border-t border-gray-800">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input className="flex-1 bg-gray-900 border border-gray-800 rounded px-4 py-2 focus:outline-none" placeholder="Say something..." value={input} onChange={(e) => setInput(e.target.value)} disabled={isStreaming} />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded disabled:opacity-50" disabled={isStreaming}>{isStreaming ? "Streaming..." : "Send"}</button>
        </div>
      </form>
    </div>
  );
}
