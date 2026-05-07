import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, Lightbulb, X, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { consoleApi, type ConsoleCard } from "@/api/console";
import { useLocale } from "@/hooks/useLocale";

interface Message {
  id: string;
  role: "user" | "console";
  text: string;
  timestamp: string;
}

const SEED_MESSAGES: Message[] = [
  {
    id: "seed-1",
    role: "user",
    text: "Qu'est-ce que Sophie a fait cette semaine ?",
    timestamp: "09:12",
  },
  {
    id: "seed-2",
    role: "console",
    text: "Sophie a qualifié 12 CV pour la mission React Senior, recommandé 3 profils à Marc, et relancé 2 candidats sans réponse. Son niveau de confiance sur la qualification de CV est à 4,8/5 — excellent.",
    timestamp: "09:12",
  },
];

const quickSuggestions = [
  "Qu'est-ce que Sophie a fait cette semaine ?",
  "Demande à Marc de préparer un rapport pour Innotec",
  "Montre-moi les candidats en attente",
];

function urgencyBorderColour(urgency: number) {
  if (urgency >= 4) return "#B91C1C";
  if (urgency >= 2) return "#C97C0A";
  return "#1A4E8C";
}

function CardRow({
  card,
  onApprove,
  approving,
  approved,
}: {
  card: ConsoleCard;
  onApprove: (card: ConsoleCard) => void;
  approving: boolean;
  approved: boolean;
}) {
  const { t } = useTranslation("console");
  return (
    <li
      className="text-sm flex items-start gap-2.5 py-2 border-b last:border-0"
      style={{ borderColor: "#1A4E8C22", color: "#1A4E8C" }}
    >
      <span className="flex-none mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ backgroundColor: urgencyBorderColour(card.urgency) + "22", color: urgencyBorderColour(card.urgency) }}>
        {card.urgency}
      </span>
      <span className="flex-1 leading-snug">{card.headline}</span>
      {card.taskId && !approved && (
        <button
          onClick={() => onApprove(card)}
          disabled={approving}
          className="flex-none text-xs font-semibold px-2.5 py-1 rounded-lg transition-opacity disabled:opacity-50 flex items-center gap-1"
          style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}
        >
          {approving ? "…" : t("actions.approve")}
        </button>
      )}
      {approved && (
        <CheckCircle2 size={16} className="flex-none text-[#1A9E68]" />
      )}
    </li>
  );
}

export function ConsoleCEO() {
  const { t } = useTranslation("console");
  const { selectedCompanyId } = useCompany();
  const { formatTime } = useLocale();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [showIntelligence, setShowIntelligence] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load real intelligence cards from the console context endpoint
  const { data: context } = useQuery({
    queryKey: ["console-context", selectedCompanyId],
    queryFn: () => consoleApi.getContext(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ cardId }: { cardId: string }) =>
      consoleApi.approveCard(selectedCompanyId!, cardId, "me"),
    onSuccess: (_, { cardId }) => {
      setApprovedIds((prev) => new Set([...prev, cardId]));
      setApprovingId(null);
      queryClient.invalidateQueries({ queryKey: ["console-context"] });
      // Confirm in chat
      const ts = formatTime(new Date());
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "console", text: t("cardApproved"), timestamp: ts },
      ]);
    },
    onError: () => setApprovingId(null),
  });

  // Use real cards if available, fall back to static seed points
  const liveCards: ConsoleCard[] = context?.cards ?? [];
  const fallbackPoints = [
    "Sophie n'a placé aucun candidat depuis 18 jours",
    "Buildtech attend un rapport depuis 12 jours",
    "Sophie est prête pour un niveau d'autonomie supérieur",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function handleSend() {
    const text = inputValue.trim();
    if (!text) return;

    const ts = formatTime(new Date());
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", text, timestamp: ts },
    ]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "console",
          text: t("thinking"),
          timestamp: formatTime(new Date()),
        },
      ]);
    }, 1400);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleApproveCard(card: ConsoleCard) {
    setApprovingId(card.id);
    approveMutation.mutate({ cardId: card.id });
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "#FAFAF8" }}>
      {/* Header */}
      <div
        className="flex-none px-6 py-4 border-b"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
      >
        <h1
          className="text-xl leading-tight"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          {t("title")}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#8A8680" }}>
          {t("subtitle")}
        </p>
      </div>

      {/* Intelligence banner — live cards if connected, seed fallback otherwise */}
      {showIntelligence && (liveCards.length > 0 || fallbackPoints.length > 0) && (
        <div
          className="flex-none mx-4 mt-4 rounded-xl border p-4"
          style={{ backgroundColor: "#EFF6FF", borderColor: "#1A4E8C33" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1">
              <Lightbulb size={18} className="flex-none mt-0.5" style={{ color: "#1A4E8C" }} />
              <div className="flex-1">
                <p className="text-sm font-semibold mb-2" style={{ color: "#1A4E8C" }}>
                  {t("intelligence.count", { count: liveCards.length || fallbackPoints.length })}
                </p>
                <div className="w-full mb-3" style={{ height: "1px", backgroundColor: "#1A4E8C22" }} />

                {liveCards.length > 0 ? (
                  <ul className="divide-y" style={{ borderColor: "#1A4E8C22" }}>
                    {liveCards.map((card) => (
                      <CardRow
                        key={card.id}
                        card={card}
                        onApprove={handleApproveCard}
                        approving={approvingId === card.id}
                        approved={approvedIds.has(card.id)}
                      />
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-1.5">
                    {fallbackPoints.map((point, i) => (
                      <li key={i} className="text-sm flex items-start gap-2" style={{ color: "#1A4E8C" }}>
                        <span className="flex-none mt-0.5">·</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <button
                    className="text-sm font-medium px-4 py-2 sm:py-1.5 rounded-lg transition-opacity hover:opacity-90 w-full sm:w-auto"
                    style={{ backgroundColor: "#1A4E8C", color: "#FFFFFF" }}
                    onClick={() => setShowIntelligence(false)}
                  >
                    {t("actions.processNow")}
                  </button>
                  <button
                    className="text-sm font-medium px-4 py-2 sm:py-1.5 rounded-lg transition-colors hover:opacity-80 w-full sm:w-auto"
                    style={{ backgroundColor: "transparent", color: "#1A4E8C", border: "1px solid #1A4E8C44" }}
                    onClick={() => setShowIntelligence(false)}
                  >
                    {t("actions.later")}
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
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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
                    style={{ backgroundColor: "#FFFFFF", color: "#0F0F0D", border: "1px solid #E8E4DC" }}
                  >
                    {msg.text}
                  </div>
                  <p className="text-xs mt-1 ml-1" style={{ color: "#8A8680" }}>{msg.timestamp}</p>
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
                <p className="text-xs mt-1 mr-1 text-right" style={{ color: "#8A8680" }}>{msg.timestamp}</p>
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
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E4DC" }}
              >
                <div className="flex gap-1 items-center">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ backgroundColor: "#8A8680", animationDelay: `${delay}ms` }}
                    />
                  ))}
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
            onClick={() => { setInputValue(s); textareaRef.current?.focus(); }}
            className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:opacity-80 truncate max-w-[240px]"
            style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC", color: "#8A8680" }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex-none px-4 pb-4">
        <div
          className="flex items-end gap-2 rounded-2xl border p-3"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
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
