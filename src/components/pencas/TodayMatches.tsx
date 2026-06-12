import type { Session } from "@auth/core/types";

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

type Group = {
  id: number;
  name: string;
  teams: Array<{ id: number; name: string; flag: string | null; fifaCode: string | null }>;
  matches: Match[];
};

type Props = {
  groups: Group[];
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

export default function TodayMatches({ groups }: Props) {
  const now = new Date();
  const todayStr = now.toDateString();

  const todayMatches = groups
    .flatMap((g) =>
      g.matches.map((m) => ({ ...m, groupName: g.name }))
    )
    .filter((m) => {
      const matchDate = new Date(m.matchDate);
      return (
        matchDate.toDateString() === todayStr &&
        m.status === "scheduled" &&
        matchDate > now
      );
    })
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime());

  if (todayMatches.length === 0) return null;

  return (
    <div class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-base">📅</span>
          <h2 class="font-barlow font-bold uppercase text-sm text-white tracking-wider">
            Partidos de hoy
          </h2>
        </div>
        <span class="text-[10px] text-muted uppercase tracking-wider">
          {todayMatches.length} partido{todayMatches.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div class="glass-card overflow-hidden divide-y divide-accent-border/15">
        {todayMatches.map((m) => (
          <div key={m.id}>
            
              href={`/matches/${m.id}`}
              class="flex items-center gap-3 px-4 py-3 hover:bg-accent-subtle/30 transition-colors group"
            >
              <div class="w-[90px] shrink-0">
                <p class="text-[11px] font-bold text-accent-light tabular-nums">
                  {formatTime(m.matchDate)}
                </p>
                <p class="text-[10px] text-muted/60 uppercase tracking-wide">
                  Grupo {m.groupName}
                </p>
              </div>

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

              <div class="flex items-center shrink-0 mx-1">
                <span class="font-barlow font-black text-sm text-muted/50 tabular-nums px-1">
                  vs
                </span>
              </div>

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

              <div class="shrink-0 w-[80px] text-right">
                <span class="text-[10px] font-bold text-accent uppercase tracking-wide">
                  Pronosticar →
                </span>
              </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}