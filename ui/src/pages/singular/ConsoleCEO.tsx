import { useState, useRef, useEffect } from "react";
import { Send, Lightbulb, X, ChevronRight } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "console";
  text: string;
  timestamp: string;
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "user",
    text: "Qu'est-ce que Sophie a fait cette semaine ?",
    timestamp: "09:12",
  },
  {
    id: "2",
    role: "console",
    text: "Sophie a qualifié 12 CV pour la mission React Senior, recommandé 3 profils à Marc, et relancé 2 candidats sans réponse. Elle a aussi détecté un signal marché intéressant que j'ai mis en carte ce matin. Son niveau de confiance sur la qualification de CV est à 4,8/5 — excellent.",
    timestamp: "09:12",
  },
  {
    id: "3",
    role: "user",
    text: "Demande à Marc de préparer un rapport pour Innotec",
    timestamp: "09:14",
  },
  {
    id: "4",
    role: "console",
    text: "C'est noté. Marc commence à travailler sur ça. Il vous donnera une première version ce soir.",
    timestamp: "09:14",
  },
];

const quickSuggestions = [
  "Qu'est-ce que Sophie a fait cette semaine ?",
  "Demande à Marc de préparer un rapport pour Innotec",
  "Montre-moi les candidats en attente",
];

const intelligencePoints = [
  "Sophie n'a placé aucun candidat depuis 18 jours",
  "Buildtech attend un rapport depuis 12 jours",
  "Sophie est prête pour un niveau d'autonomie supérieur",
];

export function ConsoleCEO() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [showIntelligence, setShowIntelligence] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function handleSend() {
    const text = inputValue.trim();
    if (!text) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const consoleMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "console",
        text: "Je transmets votre demande à l'équipe. Je vous tiens informé dès qu'une réponse est disponible.",
        timestamp: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, consoleMsg]);
    }, 1400);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestion(text: string) {
    setInputValue(text);
    textareaRef.current?.focus();
  }

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: "#FAFAF8" }}
    >
      {/* Header */}
      <div
        className="flex-none px-6 py-4 border-b"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
      >
        <h1
          className="text-xl leading-tight"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Console CEO
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#8A8680" }}>
          Propulsé par votre équipe IA
        </p>
      </div>

      {/* Intelligence banner */}
      {showIntelligence && (
        <div
          className="flex-none mx-4 mt-4 rounded-xl border p-4"
          style={{
            backgroundColor: "#EFF6FF",
            borderColor: "#1A4E8C33",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1">
              <Lightbulb
                size={18}
                className="flex-none mt-0.5"
                style={{ color: "#1A4E8C" }}
              />
              <div className="flex-1">
                <p
                  className="text-sm font-semibold mb-2"
                  style={{ color: "#1A4E8C" }}
                >
                  3 points à traiter ce matin
                </p>
                <div
                  className="w-full mb-3"
                  style={{ height: "1px", backgroundColor: "#1A4E8C22" }}
                />
                <ul className="space-y-1.5">
                  {intelligencePoints.map((point, i) => (
                    <li
                      key={i}
                      className="text-sm flex items-start gap-2"
                      style={{ color: "#1A4E8C" }}
                    >
                      <span className="flex-none mt-0.5">·</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 mt-4">
                  <button
                    className="text-sm font-medium px-4 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "#1A4E8C", color: "#FFFFFF" }}
                    onClick={() => setShowIntelligence(false)}
                  >
                    Traiter maintenant
                  </button>
                  <button
                    className="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: "transparent",
                      color: "#1A4E8C",
                      border: "1px solid #1A4E8C44",
                    }}
                    onClick={() => setShowIntelligence(false)}
                  >
                    Plus tard
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowIntelligence(false)}
              className="flex-none hover:opacity-70 transition-opacity"
              style={{ color: "#8A8680" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "console" && (
              <div className="flex items-start gap-2 max-w-[80%]">
                <div
                  className="flex-none w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ backgroundColor: "#1A9E6820", color: "#1A9E68" }}
                >
                  C
                </div>
                <div>
                  <div
                    className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
                    style={{
                      backgroundColor: "#FFFFFF",
                      color: "#0F0F0D",
                      border: "1px solid #E8E4DC",
                    }}
                  >
                    {msg.text}
                  </div>
                  <p className="text-xs mt-1 ml-1" style={{ color: "#8A8680" }}>
                    {msg.timestamp}
                  </p>
                </div>
              </div>
            )}
            {msg.role === "user" && (
              <div className="max-w-[80%]">
                <div
                  className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed"
                  style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}
                >
                  {msg.text}
                </div>
                <p
                  className="text-xs mt-1 mr-1 text-right"
                  style={{ color: "#8A8680" }}
                >
                  {msg.timestamp}
                </p>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: "#1A9E6820", color: "#1A9E68" }}
              >
                C
              </div>
              <div
                className="rounded-2xl rounded-tl-sm px-4 py-3"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E8E4DC",
                }}
              >
                <div className="flex gap-1 items-center">
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: "#8A8680", animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: "#8A8680", animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: "#8A8680", animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions */}
      <div className="flex-none px-4 pb-2 flex gap-2 flex-wrap">
        {quickSuggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => handleSuggestion(s)}
            className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:opacity-80 truncate max-w-[240px]"
            style={{
              backgroundColor: "#FFFFFF",
              borderColor: "#E8E4DC",
              color: "#8A8680",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div
        className="flex-none px-4 pb-4"
      >
        <div
          className="flex items-end gap-2 rounded-2xl border p-3"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question ou donnez une instruction à votre équipe..."
            rows={1}
            className="flex-1 resize-none text-sm outline-none bg-transparent leading-relaxed"
            style={{ color: "#0F0F0D", maxHeight: "120px" }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="flex-none w-8 h-8 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "#1A9E68" }}
          >
            <Send size={14} color="#FFFFFF" />
          </button>
        </div>
      </div>
    </div>
  );
}
