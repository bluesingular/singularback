import React, { useState } from "react";
import { X, Download } from "lucide-react";
import { useInstallPrompt } from "../hooks/useInstallPrompt.js";

export function InstallBanner() {
  const { canInstall, prompt } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-white border border-[#E8E4DC] rounded-2xl shadow-lg p-4 flex items-start gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#1A9E68]/10 flex items-center justify-center">
        <Download size={18} className="text-[#1A9E68]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F0F0D]">Installer Swwarm</p>
        <p className="text-xs text-[#8A8680] mt-0.5">
          Accedez rapidement depuis votre ecran d&apos;accueil
        </p>
        <button
          onClick={prompt}
          className="mt-2 text-xs font-medium text-[#1A9E68] hover:underline"
        >
          Installer
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-[#8A8680] hover:text-[#0F0F0D] transition-colors"
        aria-label="Fermer"
      >
        <X size={16} />
      </button>
    </div>
  );
}
