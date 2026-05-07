import React, { useState } from "react";
import { Mail, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";

async function fetchSession() {
  const res = await fetch("/api/auth/get-session", { credentials: "include" });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export function EmailVerificationBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);

  const { data } = useQuery({
    queryKey: ["auth-session-raw"],
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
  });

  const resendMutation = useMutation({
    mutationFn: () =>
      fetch("/api/v1/auth/resend-verification", {
        method: "POST",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => setSent(true),
  });

  // better-auth returns user.emailVerified on the session
  const emailVerified = (data as any)?.user?.emailVerified;

  // Only show when explicitly false (not undefined — means not supported)
  if (emailVerified !== false || dismissed) return null;

  return (
    <div className="w-full bg-[#FFF8EC] border-b border-[#C97C0A]/30 px-4 py-2.5 flex items-center gap-3">
      <Mail size={15} className="flex-shrink-0 text-[#C97C0A]" />
      <p className="flex-1 text-sm text-[#0F0F0D]">
        Vérifiez votre adresse e-mail pour activer toutes les fonctionnalités.{" "}
        {sent ? (
          <span className="font-medium text-[#1A9E68]">E-mail envoyé !</span>
        ) : (
          <button
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            className="font-medium text-[#1A4E8C] hover:underline disabled:opacity-50"
          >
            Renvoyer l&apos;e-mail
          </button>
        )}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-[#8A8680] hover:text-[#0F0F0D]"
        aria-label="Fermer"
      >
        <X size={14} />
      </button>
    </div>
  );
}
