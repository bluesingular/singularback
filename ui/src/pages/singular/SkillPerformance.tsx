/**
 * ui/src/pages/singular/SkillPerformance.tsx
 *
 * §20.8 — Tenant skill performance dashboard.
 *
 * Shows each installed skill with 30-day performance stats:
 *   - Task volume
 *   - Average quality score (from judge)
 *   - Golden training examples
 *   - Master update available indicator
 *
 * All copy is plain French — no technical slugs or model names shown.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, AlertCircle, BookOpen, Star, ArrowUpCircle } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { useNavigate } from "@/lib/router";

// ── API ───────────────────────────────────────────────────────────────────────

interface SkillStat {
  slug:             string;
  name:             string;
  gdprRequired:     boolean;
  tier:             number;
  taskCount:        number;
  completedCount:   number;
  avgJudgeScore:    number | null;  // 1–10 from LLM judge
  goldenCount:      number;
  hasUpdate:        boolean;
  installedVersion: string | null;
  masterVersion:    string | null;
}

async function fetchSkillPerformance(companyId: string): Promise<SkillStat[]> {
  const res = await fetch(`/api/companies/${companyId}/skills-performance`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load skill performance data");
  const data = await res.json() as { skills: SkillStat[] };
  return data.skills;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 8.5) return "Excellent";
  if (score >= 7.0) return "Bon";
  if (score >= 5.5) return "Moyen";
  return "À améliorer";
}

function scoreColor(score: number | null): string {
  if (score === null) return "#8A8680";
  if (score >= 8.5) return "#1A9E68";
  if (score >= 7.0) return "#C97C0A";
  return "#B91C1C";
}

// ── Skill card ────────────────────────────────────────────────────────────────

function SkillCard({ skill }: { skill: SkillStat }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm overflow-hidden cursor-pointer hover:border-[#1A9E68]/30 transition-colors"
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Header */}
      <div className="p-5 flex items-start gap-4">
        <div
          className="flex-none w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "#1A9E6815" }}
        >
          <Sparkles size={18} style={{ color: "#1A9E68" }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[#0F0F0D]">{skill.name}</h3>
            {skill.hasUpdate && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#1A4E8C15", color: "#1A4E8C" }}>
                <ArrowUpCircle size={10} /> Mise à jour disponible
              </span>
            )}
            {skill.gdprRequired && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#1A9E6815", color: "#1A9E68" }}>
                🇪🇺 RGPD
              </span>
            )}
          </div>

          {/* Quick stats row */}
          <div className="flex flex-wrap gap-4 mt-2">
            <span className="text-xs text-[#8A8680]">
              <span className="font-semibold text-[#0F0F0D]">{skill.taskCount}</span>{" "}
              tâche{skill.taskCount !== 1 ? "s" : ""} ce mois
            </span>

            {skill.avgJudgeScore !== null && (
              <span className="text-xs flex items-center gap-1">
                <Star size={11} style={{ color: scoreColor(skill.avgJudgeScore) }} />
                <span className="font-semibold" style={{ color: scoreColor(skill.avgJudgeScore) }}>
                  {scoreLabel(skill.avgJudgeScore)}
                </span>
                <span className="text-[#8A8680]">
                  ({skill.avgJudgeScore.toFixed(1).replace(".", ",")} / 10)
                </span>
              </span>
            )}

            {skill.taskCount === 0 && skill.avgJudgeScore === null && (
              <span className="text-xs text-[#8A8680]">Aucune tâche ce mois</span>
            )}
          </div>
        </div>

        {/* Golden count chip */}
        <div className="flex-none text-right">
          <span className="flex items-center gap-1 text-xs text-[#8A8680]">
            <BookOpen size={12} />
            {skill.goldenCount} exemple{skill.goldenCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#F0EDE6] px-5 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Tâches complétées" value={`${skill.completedCount} / ${skill.taskCount}`} />
            <Metric
              label="Qualité moyenne"
              value={skill.avgJudgeScore !== null ? `${skill.avgJudgeScore.toFixed(1).replace(".", ",")} / 10` : "Pas encore évaluée"}
            />
            <Metric label="Exemples d'entraînement" value={`${skill.goldenCount}`} />
            {skill.installedVersion && (
              <Metric label="Version installée" value={`v${skill.installedVersion}`} />
            )}
          </div>

          {skill.hasUpdate && (
            <div className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: "#1A4E8C08", border: "1px solid #1A4E8C22" }}>
              <AlertCircle size={14} className="flex-none mt-0.5" style={{ color: "#1A4E8C" }} />
              <div>
                <p className="text-xs font-semibold text-[#1A4E8C]">
                  Une mise à jour est disponible pour cette compétence.
                </p>
                <p className="text-xs text-[#8A8680] mt-0.5">
                  La mise à jour améliore les instructions de base.{" "}
                  Vos exemples et apprentissages sont préservés.
                </p>
                <p className="text-xs text-[#1A4E8C] mt-1">
                  Pour l'installer : Paramètres → Compétences → {skill.name}
                </p>
              </div>
            </div>
          )}

          {skill.goldenCount === 0 && (
            <div className="flex items-start gap-2 rounded-xl p-3"
              style={{ backgroundColor: "#C97C0A08", border: "1px solid #C97C0A22" }}>
              <AlertCircle size={14} className="flex-none mt-0.5" style={{ color: "#C97C0A" }} />
              <p className="text-xs text-[#8A8680]">
                Ajoutez des exemples d'entraînement pour améliorer la qualité de cette compétence.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-[#8A8680]">{label}</span>
      <span className="text-sm font-semibold text-[#0F0F0D]">{value}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SkillPerformance() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ["skill-performance", selectedCompanyId],
    queryFn: () => fetchSkillPerformance(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 5 * 60_000,
  });

  const hasUpdates = skills.some((s) => s.hasUpdate);
  const totalTasks = skills.reduce((sum, s) => sum + s.taskCount, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors w-fit"
        >
          <ArrowLeft size={14} />
          Retour
        </button>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">
            Performances de votre équipe
          </h1>
          <p className="text-sm text-[#8A8680] mt-1">
            Ce que votre équipe a accompli ce mois — 30 derniers jours.
          </p>
        </div>

        {/* Summary banner */}
        {!isLoading && skills.length > 0 && (
          <div className="rounded-2xl border border-[#E8E4DC] bg-white p-5 flex flex-wrap gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-2xl font-semibold text-[#0F0F0D]">{totalTasks}</span>
              <span className="text-xs text-[#8A8680]">tâches ce mois</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-2xl font-semibold text-[#0F0F0D]">{skills.length}</span>
              <span className="text-xs text-[#8A8680]">compétences actives</span>
            </div>
            {hasUpdates && (
              <div className="flex flex-col gap-0.5">
                <span className="text-2xl font-semibold text-[#1A4E8C]">
                  {skills.filter((s) => s.hasUpdate).length}
                </span>
                <span className="text-xs text-[#8A8680]">mise{skills.filter((s) => s.hasUpdate).length !== 1 ? "s" : ""} à jour disponible{skills.filter((s) => s.hasUpdate).length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        )}

        {/* Skill cards */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : skills.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E4DC] p-10 text-center">
            <Sparkles size={32} className="mx-auto mb-3" style={{ color: "#E8E4DC" }} />
            <p className="text-sm font-medium text-[#0F0F0D]">Aucune compétence installée</p>
            <p className="text-sm text-[#8A8680] mt-1">
              Installez un pack pour commencer.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {skills.map((skill) => (
              <SkillCard key={skill.slug} skill={skill} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
