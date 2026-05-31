import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export default function SuccesPaiement() {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  // Refresh auth context so plan is up to date, then redirect after 3s
  useEffect(() => {
    refresh().finally(() => {
      const t = setTimeout(() => navigate("/console-ceo"), 3000);
      return () => clearTimeout(t);
    });
  }, [refresh, navigate]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <CheckCircle className="w-12 h-12 text-[#1A9E68]" />
      <div>
        <h1 className="font-serif text-2xl text-[#1A1A1A]">Paiement confirmé</h1>
        <p className="text-sm text-[#6B6B6B] mt-2">
          Votre équipe est en train de se préparer. Vous allez être redirigé dans quelques instants.
        </p>
      </div>
      <button
        onClick={() => navigate("/console-ceo")}
        className="text-sm text-[#1A9E68] underline"
      >
        Accéder à la Console →
      </button>
    </div>
  );
}
