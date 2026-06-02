import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { SUPPORTED_LANGUAGES } from "../lib/i18n";

/**
 * Shared bottom section for both Sidebar and SingularSidebar.
 * Renders: language switcher + logged-in user + sign-out button.
 *
 * Language switching writes to localStorage and reloads — simple and
 * guaranteed correct regardless of i18next subscription timing.
 *
 * Active language is read from i18n.language (the live source of truth)
 * so it stays in sync if anything else calls changeLanguage().
 */
export function SidebarFooter({
  borderColor = "border-border",
  textColor = "text-foreground",
  mutedColor = "text-muted-foreground",
  activeBg = "bg-accent",
  hoverBg = "hover:bg-accent/50",
}: {
  borderColor?: string;
  textColor?: string;
  mutedColor?: string;
  activeBg?: string;
  hoverBg?: string;
}) {
  const { i18n } = useTranslation();
  const qc = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
    staleTime: Infinity,
  });

  const signOutMutation = useMutation({
    mutationFn: () => authApi.signOut(),
    onSuccess: () => {
      qc.clear();
      window.location.href = "/auth";
    },
  });

  const activeLang = i18n.language ?? "fr";

  return (
    <>
      {/* Language switcher */}
      <div className={`shrink-0 border-t ${borderColor} px-3 py-2 flex items-center gap-1`}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => {
              localStorage.setItem("singular_language", lang);
              window.location.reload();
            }}
            className={`text-[11px] font-medium px-2 py-1 rounded transition-colors uppercase tracking-wide ${
              activeLang === lang
                ? `${activeBg} ${textColor}`
                : `${mutedColor} ${hoverBg} hover:${textColor}`
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* User + sign out */}
      {sessionQuery.data && (
        <div className={`shrink-0 border-t ${borderColor} px-3 py-2 flex items-center gap-2`}>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium ${textColor} truncate`}>
              {sessionQuery.data.user.name ?? sessionQuery.data.user.email ?? "—"}
            </p>
            {sessionQuery.data.user.name && sessionQuery.data.user.email && (
              <p className={`text-[11px] ${mutedColor} truncate`}>
                {sessionQuery.data.user.email}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className={`shrink-0 ${mutedColor}`}
            onClick={() => signOutMutation.mutate()}
            disabled={signOutMutation.isPending}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}
