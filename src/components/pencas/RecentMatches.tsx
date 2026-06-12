import { useEffect, useState } from "preact/hooks";
import { actions } from "astro:actions";
import { ChevronDown } from "lucide-preact";

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

const STAGE_LABELS: Record<string, string> = {
  group: "Fase de Grupos",
  round_of_16: "Octavos",
  quarter_final: "Cuartos",
  semi_final: "Semifinal",
  third_place: "Tercer Puesto",
  final: "Final",
};

const INITIAL_SHOW = 5;

function formatMatchDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-UY", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

export default function RecentMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchMatches = () => {
      actions.pencas.getLiveMatches().then((res) => {
        if (cancelled) return;
        if (res.data) setMatches(res.data as Match[]);
        setLoading(false);
      });
    };

    fetchMatches();
    const id = setInterval(fetchMatches, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) return (
    <div class="glass-card p-6 mb-6 animate-pulse">
      <div class="h-4 w-32 bg-accent-subtle/40 rounded mb-4" />
      {[...Array(3)].map((_, i) => (
        <div key={i} class="h-12 bg-accent-subtle/20 rounded mb-2" />
      ))}
    </div>
  );

  if (matches.length === 0) return null;

  const visible = showAll ? matches : matches.slice(0, INITIAL_SHOW);
  const hidden = matches.length - INITIAL_SHOW;

  return (
    <div class="mb-8">
      {/* Header */}
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <h2 class="font-barlow font-bold uppercase text-sm text-white tracking-wider">
            Partidos recientes
          </h2>
        </div>
        <span class="text-[10px] text-muted uppercase tracking-wider">{matches.length} partidos</span>
      </div>

      {/* Match rows */}
      <div class="glass-card overflow-hidden divide-y divide-accent-border/15">
        {visible.map((m) => {
          const isLive = m.status === "live" || (m.status !== "finished" && new Date(m.matchDate) <= new Date());
          const isFinished = m.status === "finished";

          return (
            <a
              key={m.id}
              href={`/matches/${m.id}`}
              class="flex items-center gap-3 px-4 py-3 hover:bg-accent-subtle/30 transition-colors group"
            >
              {/* Date/time */}
              <div class="w-[90px] shrink-0">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-muted capitalize">
                  {formatMatchDate(m.matchDate)}
                </p>
                <p class="text-[10px] text-muted/50">{formatTime(m.matchDate)}</p>
              </div>

              {/* Home team */}
              <div class="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <span class="text-sm font-semibold text-white truncate text-right">
                  {m.homeTeam.name}
                </span>
                {m.homeTeam.flag ? (
                  <div class="w-7 aspect-[3/2] shrink-0">
                    <img src={m.homeTeam.flag} alt="" class="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div class="w-7 h-5 bg-zinc-800 rounded shrink-0" />
                )}
              </div>

              {/* Score */}
              <div class="flex items-center gap-1.5 shrink-0 mx-1">
                <span class={`font-barlow font-black text-lg tabular-nums w-6 text-center ${isLive ? "text-green-400" : "text-white"}`}>
                  {m.homeScore ?? "–"}
                </span>
                <span class="text-muted/40 text-xs">:</span>
                <span class={`font-barlow font-black text-lg tabular-nums w-6 text-center ${isLive ? "text-green-400" : "text-white"}`}>
                  {m.awayScore ?? "–"}
                </span>
              </div>

              {/* Away team */}
              <div class="flex items-center gap-2 flex-1 min-w-0">
                {m.awayTeam.flag ? (
                  <div class="w-7 aspect-[3/2] shrink-0">
                    <img src={m.awayTeam.flag} alt="" class="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div class="w-7 h-5 bg-zinc-800 rounded shrink-0" />
                )}
                <span class="text-sm font-semibold text-white truncate">
                  {m.awayTeam.name}
                </span>
              </div>

              {/* Status badge */}
              <div class="shrink-0 w-[80px] text-right">
                {isLive ? (
                  <span class="inline-flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase">
                    <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    En vivo
                  </span>
                ) : isFinished ? (
                  <span class="text-[10px] font-semibold text-accent uppercase tracking-wide flex items-center justify-end gap-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    Guardado
                  </span>
                ) : (
                  <span class="text-[10px] text-muted uppercase tracking-wide">Cargando...</span>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {/* Ver más / Ver menos */}
      {matches.length > INITIAL_SHOW && (
        <button
          onClick={() => setShowAll((v) => !v)}
          class="w-full mt-2 glass-card py-3 flex items-center justify-center gap-2 text-sm font-barlow font-bold uppercase tracking-wider text-muted hover:text-white hover:border-accent/30 transition-all duration-200 group"
        >
          <ChevronDown
            class={`w-4 h-4 transition-transform duration-300 ${showAll ? "rotate-180" : ""}`}
          />
          {showAll ? "Ver menos" : `Ver más (${hidden})`}
        </button>
      )}
    </div>
  );
}
