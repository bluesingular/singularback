import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message ?? "Connexion impossible. Vérifiez vos identifiants.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#1A9E68] flex items-center justify-center">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <span className="font-serif text-2xl text-[#1A1A1A]">Swwarm</span>
          </div>
          <p className="text-sm text-[#6B6B6B] mt-1">Votre équipe IA, au travail</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
              Adresse e-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-[#E8E4DC] bg-white text-sm outline-none focus:border-[#1A9E68] focus:ring-2 focus:ring-[#1A9E68]/10 transition-colors"
              placeholder="vous@exemple.fr"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-[#E8E4DC] bg-white text-sm outline-none focus:border-[#1A9E68] focus:ring-2 focus:ring-[#1A9E68]/10 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A9E68] hover:bg-[#158a59] disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-xs text-[#6B6B6B] mt-8">
          Singular.blue · IA souveraine européenne
        </p>
      </div>
    </div>
  );
}
