import { useEffect, useState } from "preact/hooks";
import { actions } from "astro:actions";
import { Swords } from "lucide-preact";
import type { Session } from "@auth/core/types";
import MatchCard from "./MatchCard";

type Match = {
  id: number;
  matchDate: string;
  stage: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: number; name: string; flag: string | null };
  awayTeam: { id: number; name: string; flag: string | null };
};

type PredictionMap = Record<number, { matchId: number; homeScore: number; awayScore: number; points?: number | null }>;

type Props = {
  predictions: PredictionMap;
  user: Session['user'] | null;
  onSubmit: (matchId: number, homeScore: number, awayScore: number) => void;
  submitting: boolean;
};

const KNOCKOUT_STAGES = [
  { key: "last_32", label: "Treintaydosavos de Final", abbr: "32AVOS" },
  { key: "last_16", label: "Dieciseisavos de Final", abbr: "16AVOS" },
  { key: "round_of_16", label: "Dieciseisavos de Final", abbr: "16AVOS" },
  { key: "quarter_final", label: "Cuartos de Final", abbr: "CUARTOS" },
  { key: "semi_final", label: "Semifinal", abbr: "SEMIFINAL" },
  { key: "third_place", label: "Tercer Puesto", abbr: "3ER PUESTO" },
  { key: "final", label: "Final", abbr: "FINAL" },
] as const;

export default function KnockoutView({ predictions, user, onSubmit, submitting }: Props) {
  const [matchesByStage, setMatchesByStage] = useState<Record<string, Match[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<string>("");

  useEffect(() => {
    const stages = KNOCKOUT_STAGES.map((s) => s.key);
    Promise.all(
      stages.map((stage) =>
        actions.pencas.getMatches({ stage: stage as any }).then((res) => ({
          stage,
          matches: (res.data ?? []) as Match[],
        }))
      )
    ).then((results) => {
      const byStage: Record<string, Match[]> = {};
      for (const r of results) {
        byStage[r.stage] = r.matches;
      }
      setMatchesByStage(byStage);

      const withMatches = results.filter((r) => r.matches.length > 0);
      if (withMatches.length > 0) {
        const lastWithMatches = withMatches[withMatches.length - 1];
        const hasUnfinished = withMatches.some((r) =>
          r.matches.some((m) => m.status !== "finished")
        );
        setActiveStage(
          hasUnfinished
            ? withMatches.find((r) => r.matches.some((m) => m.status !== "finished"))!.stage
            : lastWithMatches.stage
        );
      }

      setLoading(false);
    });
  }, []);

  const stagesWithMatches = KNOCKOUT_STAGES.filter(
    (s) => (matchesByStage[s.key]?.length ?? 0) > 0
  );

  if (loading) {
    return (
      <div class="glass-card p-12 text-center glow-violet">
        <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p class="text-muted text-sm">Cargando eliminatorias...</p>
      </div>
    );
  }

  if (stagesWithMatches.length === 0) {
    return (
      <div class="glass-card p-12 text-center glow-violet">
        <Swords class="h-12 w-12 mx-auto mb-4 text-accent/30" />
        <p class="text-muted text-sm">Aún no hay partidos de eliminatorias.</p>
        <p class="text-muted/50 text-xs mt-2 max-w-xs mx-auto leading-relaxed">
          Los partidos se cargarán automáticamente cuando la fase de grupos finalice.
        </p>
      </div>
    );
  }

  const currentStage = stagesWithMatches.find((s) => s.key === activeStage) ?? stagesWithMatches[0];
  const currentMatches = matchesByStage[currentStage.key] ?? [];

  return (
    <div class="space-y-4">
      {/* Stage tabs */}
      <div class="glass-card p-1.5 flex flex-wrap gap-1">
        {stagesWithMatches.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveStage(s.key)}
            class={`relative px-3 py-2 rounded-md text-sm font-barlow font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 ${
              activeStage === s.key
                ? "bg-accent text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                : "text-muted hover:text-white hover:bg-accent-subtle/40"
            }`}
          >
            <span>{s.abbr}</span>
          </button>
        ))}
      </div>

      {/* Stage header */}
      <div class="flex items-center gap-3">
        <span class="font-barlow font-black uppercase text-xs tracking-[0.2em] text-accent">
          {currentStage.label}
        </span>
        <span class="text-muted/40 text-xs">
          {currentMatches.length} partido{currentMatches.length !== 1 ? "s" : ""}
        </span>
        <div class="flex-1 h-px bg-accent-border/20" />
      </div>

      {/* Match cards */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        {currentMatches.map((match) => {
          const existing = predictions[match.id];
          const prediction = existing
            ? {
                matchId: existing.matchId,
                homeScore: existing.homeScore,
                awayScore: existing.awayScore,
                points: existing.points ?? null,
              }
            : { matchId: match.id, homeScore: match.homeScore ?? 0, awayScore: match.awayScore ?? 0, points: null };

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

      {currentMatches.length === 0 && (
        <div class="glass-card p-10 text-center">
          <p class="text-muted/50 text-sm">Sin partidos para esta ronda.</p>
        </div>
      )}
    </div>
  );
}
