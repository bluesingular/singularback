/**
 * Gap A — Stripe checkout success page.
 *
 * Shown after Stripe redirects back with ?session_id=...
 * Validates the session, then redirects to the CEO Console.
 */

import { useEffect } from "react";
import { useNavigate, useSearchParams } from "@/lib/router";
import { CheckCircle2, Loader2 } from "lucide-react";

export function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Give Stripe webhook a moment to process before redirecting
    const timer = setTimeout(() => {
      navigate("/", { replace: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#FAFAF8] gap-6 p-8">
      {/* Brand */}
      <span className="text-2xl font-serif tracking-tight" style={{ color: "#1A4E8C" }}>
        Swwarm
      </span>

      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="h-16 w-16 rounded-full bg-[#1A9E68]/10 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-[#1A9E68]" />
        </div>

        <div>
          <h1 className="text-2xl font-serif font-semibold text-[#0F0F0D]">
            Bienvenue dans Swwarm !
          </h1>
          <p className="mt-2 text-sm text-[#8A8680]">
            Votre abonnement est activé. Votre équipe IA vous attend.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-[#8A8680]">
          <Loader2 size={14} className="animate-spin" />
          Redirection vers votre Console CEO…
        </div>
      </div>

      {sessionId && (
        <p className="text-xs text-[#C8C4BB]">Référence : {sessionId.slice(0, 16)}…</p>
      )}
    </div>
  );
}
