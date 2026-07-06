import { useState, useMemo } from "preact/hooks";
import { Trophy } from "lucide-preact";
import type { Session } from "@auth/core/types";
import MatchCard from "./MatchCard";
import GroupStandings from "./GroupStandings";

type Group = {
  id: number;
  name: string;
  teams: Array<{ id: number; name: string; flag: string | null; fifaCode: string | null }>;
  matches: Array<{
    id: number;
    matchDate: string;
    stage: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: { id: number; name: string; flag: string | null };
    awayTeam: { id: number; name: string; flag: string | null };
  }>;
};

type PredictionMap = Record<number, { matchId: number; homeScore: number; awayScore: number; points?: number | null }>;

type Props = {
  groups: Group[];
  predictions: PredictionMap;
  user: Session['user'] | null;
  onSubmit: (matchId: number, homeScore: number, awayScore: number) => void;
  submitting: boolean;
};

// Group matches by fecha (round)
function groupByFecha(matches: Group["matches"]) {
  const fechas: Record<number, Group["matches"]> = {};
  const sorted = [...matches].sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
  );
  // Chunk en grupos de 2 → Fecha 1, Fecha 2, Fecha 3
  sorted.forEach((m, i) => {
    const round = Math.floor(i / 2) + 1;
    if (!fechas[round]) fechas[round] = [];
    fechas[round].push(m);
  });
  return fechas;
}

export default function GroupsView({ groups, predictions, user, onSubmit, submitting }: Props) {
  const [activeGroup, setActiveGroup] = useState<string>(groups[0]?.name ?? "A");

  const currentGroup = groups.find((g) => g.name === activeGroup);
  const fechas = useMemo(
    () => (currentGroup ? groupByFecha(currentGroup.matches) : {}),
    [currentGroup]
  );

  if (groups.length === 0) {
    return (
      <div class="glass-card p-12 text-center glow-violet">
        <Trophy class="h-12 w-12 mx-auto mb-4 text-accent/30" />
        <p class="text-muted text-sm">La competencia aún no ha comenzado.</p>
        <p class="text-muted/50 text-xs mt-2 max-w-xs mx-auto leading-relaxed">
          Los datos se cargarán automáticamente cuando estén disponibles.
        </p>
      </div>
    );
  }

  return (
    <div class="space-y-4">
      {/* Group tabs */}
      <div class="glass-card p-1.5 flex flex-wrap gap-1">
        {groups.map((g) => (
          <button
            key={g.name}
            onClick={() => setActiveGroup(g.name)}
            class={`relative px-3 py-2 rounded-md text-sm font-barlow font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 ${activeGroup === g.name
              ? "bg-accent text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]"
              : "text-muted hover:text-white hover:bg-accent-subtle/40"
              }`}
          >
            <span>Grupo {g.name}</span>

          </button>
        ))}
      </div>

      {/* Main content: matches + standings */}
      {currentGroup && (
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
          {/* Matches by fecha */}
          <div class="space-y-5">
            {Object.entries(fechas).map(([fechaNum, matches]) => (
              <div key={fechaNum}>
                {/* Fecha header */}
                <div class="flex items-center gap-3 mb-3">
                  <span class="font-barlow font-black uppercase text-xs tracking-[0.2em] text-accent">
                    Fecha {fechaNum}
                  </span>
                  <span class="text-muted/40 text-xs">{matches.length} partido{matches.length !== 1 ? "s" : ""}</span>
                  <div class="flex-1 h-px bg-accent-border/20" />
                </div>

                {/* Match cards grid: 2 columns on md+ */}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {matches.map((match) => {
                    const existing = predictions[match.id];
                    const prediction: { matchId: number; homeScore: number; awayScore: number; points: number | null } | null = existing
                      ? {
                        matchId: existing.matchId,
                        homeScore: existing.homeScore,
                        awayScore: existing.awayScore,
                        points: existing.points ?? null,
                      }
                      : null;

                    return (
                      <MatchCard
                        key={match.id}
                        match={match}
                        prediction={prediction}
                        user={user}
                        onSubmit={onSubmit}
                        submitting={submitting}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {currentGroup.matches.length === 0 && (
              <div class="glass-card p-10 text-center">
                <p class="text-muted/50 text-sm">Sin partidos para este grupo.</p>
              </div>
            )}
          </div>

          {/* Standings sidebar */}
          <GroupStandings
            groupName={currentGroup.name}
            teams={currentGroup.teams}
            matches={currentGroup.matches}
          />
        </div>
      )}
    </div>
  );
}
