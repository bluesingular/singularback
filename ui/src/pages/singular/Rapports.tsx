import { useState } from "react";
import { TrendingUp, Clock, Euro, Users, Share2, ChevronDown } from "lucide-react";

const agentActivity = [
  { name: "Sophie", tasks: 23, agent: "sourcing" },
  { name: "Marc", tasks: 8, agent: "client" },
  { name: "Clara", tasks: 5, agent: "content" },
  { name: "Julien", tasks: 12, agent: "admin" },
  { name: "Iris", tasks: 4, agent: "market" },
];

const maxTasks = Math.max(...agentActivity.map((a) => a.tasks));

const taskBreakdown = [
  {
    label: "Qualification de CV",
    tasks: 23,
    translation: "≈ 3 lots de qualification complets",
    agent: "Sophie",
  },
  {
    label: "Emails clients",
    tasks: 8,
    translation: "≈ 8 emails envoyés",
    agent: "Marc",
  },
  {
    label: "Rapports hebdo",
    tasks: 5,
    translation: "≈ 1 rapport complet par semaine",
    agent: "Clara",
  },
  {
    label: "Suivi candidats",
    tasks: 12,
    translation: "≈ 12 emails de suivi",
    agent: "Julien",
  },
  {
    label: "Veille marché",
    tasks: 4,
    translation: "≈ 4 rapports de veille",
    agent: "Iris",
  },
];

const agentColors: Record<string, string> = {
  sourcing: "#1A9E68",
  client: "#1A4E8C",
  content: "#C97C0A",
  admin: "#6B7280",
  market: "#7C3AED",
};

const periods = ["Ce mois", "Mois dernier", "3 derniers mois"];

export function Rapports() {
  const [period, setPeriod] = useState("Ce mois");
  const [fteCount, setFteCount] = useState(1.2);

  const monthlyCostHuman = Math.round(fteCount * 2800 * 1.45);
  const monthlyCostAI = 250;
  const savings = monthlyCostHuman - monthlyCostAI;

  return (
    <div
      className="min-h-screen px-6 py-6"
      style={{ backgroundColor: "#FAFAF8" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-2xl"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Rapports
        </h1>
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="appearance-none text-sm pl-3 pr-8 py-2 rounded-lg border cursor-pointer outline-none"
            style={{
              backgroundColor: "#FFFFFF",
              borderColor: "#E8E4DC",
              color: "#0F0F0D",
            }}
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "#8A8680" }}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Tasks */}
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          <div className="flex items-start justify-between mb-2">
            <TrendingUp size={18} style={{ color: "#1A9E68" }} />
          </div>
          <p
            className="text-2xl font-semibold"
            style={{ color: "#0F0F0D" }}
          >
            847
          </p>
          <p className="text-sm mt-0.5" style={{ color: "#0F0F0D" }}>
            tâches réalisées
          </p>
          <p className="text-xs mt-1" style={{ color: "#8A8680" }}>
            dont ≈ 121 sélections de CV
          </p>
        </div>

        {/* Time saved */}
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          <div className="flex items-start justify-between mb-2">
            <Clock size={18} style={{ color: "#1A4E8C" }} />
          </div>
          <p
            className="text-2xl font-semibold"
            style={{ color: "#0F0F0D" }}
          >
            5 h
          </p>
          <p className="text-sm mt-0.5" style={{ color: "#0F0F0D" }}>
            libérées par semaine
          </p>
          <p className="text-xs mt-1" style={{ color: "#8A8680" }}>
            temps estimé récupéré
          </p>
        </div>

        {/* AI cost */}
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          <div className="flex items-start justify-between mb-2">
            <Euro size={18} style={{ color: "#C97C0A" }} />
          </div>
          <p
            className="text-2xl font-semibold"
            style={{ color: "#0F0F0D" }}
          >
            ≈ 250 €
          </p>
          <p className="text-sm mt-0.5" style={{ color: "#0F0F0D" }}>
            coût ce mois
          </p>
          <p className="text-xs mt-1" style={{ color: "#8A8680" }}>
            équipe IA complète
          </p>
        </div>

        {/* Human equivalent */}
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          <div className="flex items-start justify-between mb-2">
            <Users size={18} style={{ color: "#8A8680" }} />
          </div>
          <p
            className="text-2xl font-semibold"
            style={{ color: "#0F0F0D" }}
          >
            ≈ 3 200 €
          </p>
          <p className="text-sm mt-0.5" style={{ color: "#0F0F0D" }}>
            équivalent humain
          </p>
          <p className="text-xs mt-1" style={{ color: "#8A8680" }}>
            coût mensuel estimé
          </p>
        </div>
      </div>

      {/* Hire simulator */}
      <div
        className="rounded-xl border p-5 mb-6"
        style={{ backgroundColor: "#1A9E6808", borderColor: "#1A9E6840" }}
      >
        <h2
          className="text-base font-semibold mb-1"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Simulateur d'embauche
        </h2>
        <div
          className="w-full mb-4"
          style={{ height: "1px", backgroundColor: "#1A9E6830" }}
        />

        <p className="text-sm mb-4" style={{ color: "#0F0F0D" }}>
          Votre équipe IA fait le travail de{" "}
          <span
            className="font-semibold"
            style={{ color: "#1A9E68" }}
          >
            {fteCount.toFixed(1).replace(".", ",")} ETP
          </span>{" "}
          à{" "}
          <span className="font-semibold" style={{ color: "#1A9E68" }}>
            {monthlyCostAI} €/mois
          </span>
          .
        </p>

        <div
          className="rounded-lg p-4 mb-4 text-sm space-y-1"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E4DC" }}
        >
          <p style={{ color: "#0F0F0D" }}>
            Si vous embauchiez un chargé de sourcing junior :{" "}
            <span className="font-medium">
              {(fteCount * 2800).toLocaleString("fr-FR")} €/mois brut
            </span>
          </p>
          <p style={{ color: "#8A8680" }}>
            + charges (≈ ×1,45) :{" "}
            <span className="font-medium" style={{ color: "#0F0F0D" }}>
              {monthlyCostHuman.toLocaleString("fr-FR")} €/mois
            </span>
          </p>
          <div
            className="pt-2 mt-2 border-t font-semibold"
            style={{ borderColor: "#E8E4DC", color: "#1A9E68" }}
          >
            Économie estimée : {savings.toLocaleString("fr-FR")} €/mois
          </div>
        </div>

        <div>
          <label
            className="text-xs font-medium block mb-2"
            style={{ color: "#8A8680" }}
          >
            Ajuster la comparaison — {fteCount.toFixed(1).replace(".", ",")} ETP
          </label>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.1}
            value={fteCount}
            onChange={(e) => setFteCount(parseFloat(e.target.value))}
            className="w-full accent-[#1A9E68]"
            style={{ accentColor: "#1A9E68" }}
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: "#8A8680" }}>
            <span>0,5 ETP</span>
            <span>3 ETP</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Activity by agent */}
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          <h2
            className="text-base font-semibold mb-4"
            style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
          >
            Activité par agent
          </h2>
          <div className="space-y-3">
            {agentActivity.map((agent) => {
              const widthPct = Math.round((agent.tasks / maxTasks) * 100);
              const color = agentColors[agent.agent];
              return (
                <div key={agent.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm" style={{ color: "#0F0F0D" }}>
                      {agent.name}
                    </span>
                    <span className="text-sm font-medium" style={{ color }}>
                      {agent.tasks} tâches
                    </span>
                  </div>
                  <div
                    className="w-full rounded-full h-2"
                    style={{ backgroundColor: "#F3F4F6" }}
                  >
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${widthPct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task breakdown */}
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          <h2
            className="text-base font-semibold mb-4"
            style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
          >
            Répartition des tâches
          </h2>
          <div className="space-y-3">
            {taskBreakdown.map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-3 pb-3 border-b last:border-0 last:pb-0"
                style={{ borderColor: "#E8E4DC" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#0F0F0D" }}>
                    {item.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#8A8680" }}>
                    {item.translation}
                  </p>
                </div>
                <div className="text-right flex-none">
                  <p className="text-sm font-semibold" style={{ color: "#0F0F0D" }}>
                    {item.tasks}
                  </p>
                  <p className="text-xs" style={{ color: "#8A8680" }}>
                    tâches
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Share CTA */}
      <div
        className="rounded-xl border p-5 flex items-center justify-between"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: "#0F0F0D" }}>
            Première semaine accomplie
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#8A8680" }}>
            Partagez vos résultats avec votre réseau
          </p>
        </div>
        <button
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}
        >
          <Share2 size={14} />
          Partager votre première semaine
        </button>
      </div>
    </div>
  );
}
