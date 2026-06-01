import { useState } from "react";
import { Search, Plus, Users } from "lucide-react";

type FilterTab = "all" | "candidates" | "clients" | "partners";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "candidates", label: "Candidates" },
  { key: "clients",    label: "Clients" },
  { key: "partners",   label: "Partners" },
];

export function Contacts() {
  const [searchQuery,  setSearchQuery]  = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  return (
    <div className="min-h-screen px-6 py-6" style={{ backgroundColor: "#FAFAF8" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl" style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}>
          Contacts
        </h1>
        <button
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg opacity-50 cursor-not-allowed"
          style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}
          disabled
        >
          <Plus size={14} />
          Add contact
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8A8680" }} />
        <input
          type="text"
          placeholder="Search contacts…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC", color: "#0F0F0D" }}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className="text-sm px-4 py-1.5 rounded-full transition-colors"
            style={
              activeFilter === tab.key
                ? { backgroundColor: "#0F0F0D", color: "#FFFFFF" }
                : { backgroundColor: "transparent", color: "#8A8680" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div
        className="rounded-2xl border p-12 text-center flex flex-col items-center gap-4"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F5F5F3" }}>
          <Users size={24} style={{ color: "#8A8680" }} />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: "#0F0F0D" }}>
            No contacts yet
          </p>
          <p className="text-xs mt-1.5 max-w-xs mx-auto" style={{ color: "#8A8680" }}>
            Contacts are created automatically when your agents interact with people — candidates, clients, and partners will appear here.
          </p>
        </div>
      </div>

      <p className="text-xs text-center mt-6" style={{ color: "#8A8680" }}>
        Full contact management and relationship history coming soon.
      </p>
    </div>
  );
}
