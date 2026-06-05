import { useEffect, useState } from "preact/hooks";
import { actions } from "astro:actions";

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

export default function LiveMatches() {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    actions.pencas.getLiveMatches().then((res) => {
      if (res.data) setMatches(res.data as Match[]);
    });
  }, []);

  if (matches.length === 0) return null;

  return (
    <div class="mb-8">
      <div class="flex items-center gap-2 mb-4">
        <span class="w-2 h-2 rounded-full bg-green-accent animate-pulse" />
        <h2 class="font-barlow font-bold uppercase text-sm text-white tracking-wider">
          Partidos en curso
        </h2>
      </div>

      <div class="grid gap-3">
        {matches.map((m) => (
          <a
            key={m.id}
            href={`/matches/${m.id}`}
            class="glass-card !bg-green-accent/5 border-green-accent/20 hover:border-green-accent/40 transition-all duration-300 p-4 flex items-center justify-between group hover:shadow-[0_0_25px_rgba(34,197,94,0.12)] hover:-translate-y-0.5"
          >
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <span class="text-sm font-semibold text-white truncate">{m.homeTeam.name}</span>
              <span class="shrink-0 badge-pill !bg-green-accent/15 !text-green-accent !text-[10px]">
                EN VIVO
              </span>
            </div>

            <div class="flex items-center gap-3 shrink-0 mx-4">
              <span class="font-barlow font-black text-xl text-white tabular-nums w-8 text-center">
                {m.homeScore ?? "-"}
              </span>
              <span class="text-green-accent/50 font-bold">-</span>
              <span class="font-barlow font-black text-xl text-white tabular-nums w-8 text-center">
                {m.awayScore ?? "-"}
              </span>
            </div>

            <div class="flex items-center gap-3 flex-1 min-w-0 justify-end">
              <span class="text-sm font-semibold text-white truncate">{m.awayTeam.name}</span>
              {m.awayTeam.flag && (
                <img src={m.awayTeam.flag} alt="" class="h-6 w-6 object-contain shrink-0" />
              )}
            </div>

            <svg class="w-4 h-4 ml-3 text-muted group-hover:text-white transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
