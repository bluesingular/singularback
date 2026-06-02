/**
 * ui/src/pages/singular/Inscription.tsx
 *
 * Gap A — Self-service signup page (French).
 * Collects name, email, password, company name → POST /api/v1/auth/signup.
 * On success: redirects to /{issuePrefix}/installation (onboarding wizard).
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { authApi } from "../../api/auth";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Form field ─────────────────────────────────────────────────────────────────

function Field({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        className={cn(
          "rounded-md border border-input bg-background px-3 py-2 text-sm",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function Signup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      authApi.signupWithCompany({
        name: name.trim(),
        email: email.trim(),
        password,
        companyName: companyName.trim(),
        locale: "fr",
        timezone: "Europe/Paris",
      }),
    onSuccess: async (data) => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      // Redirect to the onboarding wizard for the new company
      navigate(`/${data.company.issuePrefix}/catalogue`, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    },
  });

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    companyName.trim().length > 0;

  return (
    <div className="fixed inset-0 flex bg-[#FAFAF8]">
      {/* Left — form */}
      <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto px-8 py-12">
          {/* Brand */}
          <div className="mb-10">
            <span
              className="text-2xl font-serif tracking-tight"
              style={{ color: "#1A4E8C" }}
            >
              Swwarm
            </span>
          </div>

          {/* Headline */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif font-semibold leading-snug text-foreground">
              Votre équipe IA
              <br />
              vous attend.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Créez votre compte en 30 secondes.
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit && !mutation.isPending) mutation.mutate();
            }}
            className="flex flex-col gap-4"
          >
            <Field
              id="name"
              label="Full name"
              value={name}
              onChange={setName}
              placeholder="Isabelle Martin"
              autoComplete="name"
              disabled={mutation.isPending}
            />
            <Field
              id="email"
              label="Adresse e-mail"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="isabelle@cabinetmartin.fr"
              autoComplete="email"
              disabled={mutation.isPending}
            />
            <Field
              id="password"
              label="Mot de passe"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="8 characters minimum"
              autoComplete="new-password"
              disabled={mutation.isPending}
            />
            <Field
              id="companyName"
              label="Nom de votre cabinet ou entreprise"
              value={companyName}
              onChange={setCompanyName}
              placeholder="Cabinet Martin RH"
              autoComplete="organization"
              disabled={mutation.isPending}
            />

            {error && (
              <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={!canSubmit || mutation.isPending}
              className="mt-2 w-full"
              style={{ background: "#1A9E68" }}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création en cours…
                </>
              ) : (
                "Create my account →"
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-2">
              Déjà un compte ?{" "}
              <a href="/auth" className="underline hover:text-foreground">
                Se connecter
              </a>
            </p>
          </form>
        </div>
      </div>

      {/* Right — brand visual */}
      <div
        className="hidden md:flex w-1/2 flex-col items-center justify-center p-12"
        style={{ background: "#1A4E8C" }}
      >
        <blockquote className="max-w-sm text-center text-white">
          <p className="text-xl font-serif leading-relaxed">
            "Sophie qualified 47 CVs this month. I spent my mornings with clients."
          </p>
          <footer className="mt-4 text-sm opacity-70">
            — Isabelle M., Cabinet de recrutement, Lyon
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
