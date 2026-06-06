import { useState } from "preact/hooks";
import { ChevronDown, Trophy } from "lucide-preact";
import type { Session } from "@auth/core/types";
import MatchCard from "./MatchCard";

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

type PredictionMap = Record<number, { homeScore: number; awayScore: number; points?: number | null }>;

type Props = {
  groups: Group[];
  predictions: PredictionMap;
  session: Session | null;
  onSubmit: (matchId: number, homeScore: number, awayScore: number) => void;
  submitting: boolean;
};

export default function GroupsView({ groups, predictions, session, onSubmit, submitting }: Props) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(groups.map((g) => g.name)));

  function toggleGroup(name: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

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
    <div class="space-y-3">
      {groups.map((group) => (
        <div key={group.name} class={`glass-card overflow-hidden transition-all duration-300 ${openGroups.has(group.name) ? 'glow-violet' : 'hover:shadow-[0_0_20px_rgba(139,92,246,0.06)]'}`}>
          <button
            onClick={() => toggleGroup(group.name)}
            class="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-accent-subtle/50 transition"
          >
            <div class="flex items-center gap-3">
              <ChevronDown
                class={`h-4 w-4 text-accent transition-transform duration-200 ${openGroups.has(group.name) ? "rotate-0" : "-rotate-90"
                  }`}
              />
              <span class="font-barlow font-bold uppercase text-base text-white tracking-wide">
                Grupo {group.name}
              </span>
              <span class="text-[11px] text-muted font-semibold uppercase tracking-wider hidden sm:inline">
                {group.teams.length} equipos &middot; {group.matches.length} partidos
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              {group.teams.map((team) => (
                <span key={team.id} class="inline-block" title={team.name}>
                  {team.flag ? (
                    <div class="w-8 aspect-[3/2]">
                      <img
                        src={team.flag}
                        alt=""
                        class="w-full h-full object-cover"
                      />
                    </div>) : (
                    <span class="text-[10px] font-bold text-muted uppercase px-1.5 py-0.5 rounded bg-zinc-800/50">
                      {team.fifaCode ?? team.name.slice(0, 3)}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </button>

          {openGroups.has(group.name) && (
            <div class="border-t border-accent-border/20 p-4 sm:p-5 space-y-3 animate-scale-in">
              {group.matches.length === 0 ? (
                <div class="text-center py-8">
                  <p class="text-muted/50 text-sm">Sin partidos disponibles.</p>
                  <p class="text-muted/30 text-[11px] mt-1">La competencia no ha comenzado</p>
                </div>
              ) : (
                group.matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    prediction={predictions[match.id] ?? null}
                    session={session}
                    onSubmit={onSubmit}
                    submitting={submitting}
                  />
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
