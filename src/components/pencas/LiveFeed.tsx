import { useEffect, useRef, useState } from "preact/hooks";
import { actions } from "astro:actions";

type LiveFeedEvent = {
  id: string;
  minute: string;
  type: number;
  typeName: string;
  description: string;
  teamId?: string;
  playerId?: string;
  homeGoals: number;
  awayGoals: number;
};

type LiveFeedData = {
  matchTime: string;
  period: number;
  matchStatus: number;
  homeScore: number;
  awayScore: number;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  homeTeamTactics: string;
  awayTeamTactics: string;
  events: LiveFeedEvent[];
};

type Props = {
  matchId: number;
};

function getEventIcon(type: number): string {
  switch (type) {
    case 0: return "⚽";
    case 1: return "👟";
    case 2: return "🟨";
    case 3: return "🟥";
    case 4: return "🟨🟥";
    case 5: return "❌";
    case 6: return "⚽";
    case 7: return "⏱️";
    case 8: return "⏸️";
    case 9: return "▶️";
    case 10: return "🏁";
    case 12: return "🎯";
    case 13: return "↗️";
    case 14: return "🛡️";
    case 15: return "🚩";
    case 16: return "🔄";
    case 17: return "📏";
    case 18: return "⚡";
    case 19: return "🧤";
    case 57: return "🧤";
    case 79: return "▶️";
    case 83: return "⏸️";
    default: return "📌";
  }
}

function getEventColor(type: number): string {
  switch (type) {
    case 0: return "text-green-accent";
    case 2: return "text-yellow-400";
    case 3: return "text-red-500";
    case 4: return "text-red-500";
    case 12: return "text-accent-light";
    case 57: return "text-sky-400";
    case 18: return "text-orange-400";
    default: return "text-muted";
  }
}

function isHighlight(type: number): boolean {
  return type === 0 || type === 2 || type === 3 || type === 4;
}

function getPeriodLabel(period: number): string {
  switch (period) {
    case 1: return "1er tiempo";
    case 2: return "2do tiempo";
    case 3: return "Tiempo reglamentario";
    case 4: return "1er tiempo extra";
    case 5: return "2do tiempo extra";
    case 6: return "Tanda de penales";
    default: return "";
  }
}

function parseMatchTime(matchTime: string): { base: string; added: string | null } {
  if (!matchTime) return { base: "0'", added: null };
  const clean = matchTime.replace(/[^\d'+]/g, "");
  const plusMatch = clean.match(/^(\d+)'\+?(\d+)?$/);
  if (plusMatch) {
    const base = plusMatch[1] + "'";
    const added = plusMatch[2] ? "+" + plusMatch[2] : null;
    return { base, added };
  }
  const simpleMatch = clean.match(/^(\d+)'/);
  if (simpleMatch) return { base: simpleMatch[1] + "'", added: null };
  return { base: matchTime, added: null };
}

export default function LiveFeed({ matchId }: Props) {
  const [feed, setFeed] = useState<LiveFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchFeed() {
      const res = await actions.pencas.getLiveFeed({ matchId });
      if (cancelled) return;

      if (res.data) {
        setFeed(res.data as LiveFeedData);
        setError(null);
        setLastUpdate(new Date());
      } else if (res.error) {
        setError(res.error.message);
      }

      setLoading(false);
    }

    fetchFeed();
    const id = setInterval(fetchFeed, 12000);
    return () => { cancelled = true; clearInterval(id); };
  }, [matchId]);

  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [feed?.events.length]);

  if (loading) {
    return (
      <div class="glass-card p-6">
        <div class="flex items-center gap-2 mb-4">
          <span class="w-2 h-2 rounded-full bg-green-accent animate-pulse" />
          <h3 class="font-barlow font-bold uppercase text-sm text-white">Live Feed</h3>
        </div>
        <div class="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} class="flex items-center gap-3 animate-pulse">
              <div class="w-8 h-8 rounded-full bg-accent-subtle" />
              <div class="flex-1 space-y-2">
                <div class="h-3 bg-accent-subtle rounded w-1/4" />
                <div class="h-3 bg-accent-subtle rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="glass-card p-6">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-2 h-2 rounded-full bg-green-accent animate-pulse" />
          <h3 class="font-barlow font-bold uppercase text-sm text-white">Live Feed</h3>
        </div>
        <div class="text-center py-4">
          <p class="text-muted text-sm">{error}</p>
          <p class="text-muted/50 text-xs mt-1">Datos de FIFA no disponibles para este partido</p>
        </div>
      </div>
    );
  }

  if (!feed) return null;

  const { base: matchBase, added: matchAdded } = parseMatchTime(feed.matchTime);

  const goals = feed.events.filter((e) => e.type === 0);
  const yellowCards = feed.events.filter((e) => e.type === 2);
  const redCards = feed.events.filter((e) => e.type === 3);
  const shots = feed.events.filter((e) => e.type === 12);
  const fouls = feed.events.filter((e) => e.type === 18);

  return (
    <div class="glass-card overflow-hidden">
      {/* Header */}
      <div class="p-4 sm:p-5 border-b border-accent-border/20">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-green-accent animate-pulse" />
            <h3 class="font-barlow font-bold uppercase text-sm text-white">Live Feed</h3>
          </div>
          <span class="text-[10px] text-muted/50 font-mono">
            {lastUpdate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>

        {/* Score Header */}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 flex-1">
            <span class="font-barlow font-bold text-sm text-white">{feed.homeTeamAbbr}</span>
            <span class="text-[10px] text-muted/50 font-mono">{feed.homeTeamTactics}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0 mx-3">
            <span class="font-barlow font-black text-2xl text-white tabular-nums">{feed.homeScore}</span>
            <span class="text-accent/30 font-bold">-</span>
            <span class="font-barlow font-black text-2xl text-white tabular-nums">{feed.awayScore}</span>
          </div>
          <div class="flex items-center gap-3 flex-1 justify-end">
            <span class="text-[10px] text-muted/50 font-mono">{feed.awayTeamTactics}</span>
            <span class="font-barlow font-bold text-sm text-white">{feed.awayTeamAbbr}</span>
          </div>
        </div>

        {/* Match time */}
        <div class="flex items-center justify-center mt-3 gap-3">
          <span class="badge-pill !bg-green-accent/15 !text-green-accent !text-[10px]">
            {matchBase || "0'"}
            {matchAdded && (
              <span class="ml-1 !text-green-accent/60 font-normal">{matchAdded}</span>
            )}
          </span>
          <span class="text-[10px] text-muted/50 uppercase tracking-wider">
            {getPeriodLabel(feed.period)}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div class="grid grid-cols-4 gap-px bg-accent-border/10 border-b border-accent-border/20">
        <div class="bg-surface/50 py-2.5 text-center">
          <div class="font-barlow font-bold text-sm text-white">{goals.length}</div>
          <div class="text-[9px] text-muted uppercase tracking-wider">Goles</div>
        </div>
        <div class="bg-surface/50 py-2.5 text-center">
          <div class="font-barlow font-bold text-sm text-white">{shots.length}</div>
          <div class="text-[9px] text-muted uppercase tracking-wider">Remates</div>
        </div>
        <div class="bg-surface/50 py-2.5 text-center">
          <div class="font-barlow font-bold text-sm text-white">{yellowCards.length + redCards.length}</div>
          <div class="text-[9px] text-muted uppercase tracking-wider">Tarjetas</div>
        </div>
        <div class="bg-surface/50 py-2.5 text-center">
          <div class="font-barlow font-bold text-sm text-white">{fouls.length}</div>
          <div class="text-[9px] text-muted uppercase tracking-wider">Faltas</div>
        </div>
      </div>

      {/* Timeline */}
      <div
        ref={timelineRef}
        class="max-h-[400px] overflow-y-auto scrollbar-thin"
        style={{ scrollBehavior: "smooth" }}
      >
        {feed.events.length === 0 ? (
          <div class="p-8 text-center">
            <p class="text-muted text-sm">Esperando eventos del partido...</p>
          </div>
        ) : (
          <div class="relative">
            {/* Timeline line */}
            <div class="absolute left-[23px] top-0 bottom-0 w-px bg-accent-border/20" />

            {feed.events.map((event) => (
              <div
                key={event.id}
                class={`relative flex items-start gap-3 px-4 sm:px-5 py-2.5 transition-colors ${
                  isHighlight(event.type)
                    ? "bg-accent-subtle/30"
                    : "hover:bg-accent-subtle/10"
                }`}
              >
                {/* Minute */}
                <div class="w-10 text-right shrink-0 z-10">
                  <span class="font-barlow font-bold text-xs text-muted tabular-nums">
                    {event.minute}
                  </span>
                </div>

                {/* Icon dot */}
                <div class="relative z-10 shrink-0">
                  <div
                    class={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] border-2 border-surface ${
                      isHighlight(event.type)
                        ? "bg-accent shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                        : "bg-surface border-accent-border/40"
                    }`}
                  >
                    {getEventIcon(event.type)}
                  </div>
                </div>

                {/* Description */}
                <div class="flex-1 min-w-0 pt-0.5">
                  <p class={`text-sm leading-tight ${getEventColor(event.type)} ${
                    isHighlight(event.type) ? "font-semibold" : ""
                  }`}>
                    {event.description}
                  </p>
                  {event.type === 0 && (
                    <p class="text-[10px] text-muted/50 mt-0.5 tabular-nums">
                      {event.homeGoals} - {event.awayGoals}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div class="px-4 sm:px-5 py-2.5 border-t border-accent-border/20 bg-accent-subtle/20">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-muted/40 font-mono">
            {feed.events.length} eventos
          </span>
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-green-accent animate-pulse" />
            <span class="text-[10px] text-muted/40 uppercase tracking-wider">
              Actualizando cada 12s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
