type Team = {
  id: number;
  name: string;
  flag: string | null;
  fifaCode: string | null;
};

type Match = {
  id: number;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { id: number; name: string; flag: string | null };
  awayTeam: { id: number; name: string; flag: string | null };
};

type Props = {
  groupName: string;
  teams: Team[];
  matches: Match[];
};

type Standing = {
  team: Team;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
};

function computeStandings(teams: Team[], matches: Match[]): Standing[] {
  const map: Record<number, Standing> = {};
  for (const t of teams) {
    map[t.id] = { team: t, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0 };
  }

  for (const m of matches) {
    if (m.status !== "finished" || m.homeScore === null || m.awayScore === null) continue;
    const h = map[m.homeTeam.id];
    const a = map[m.awayTeam.id];
    if (!h || !a) continue;
    h.pj++; a.pj++;
    h.gf += m.homeScore; h.gc += m.awayScore;
    a.gf += m.awayScore; a.gc += m.homeScore;
    if (m.homeScore > m.awayScore) { h.pg++; h.pts += 3; a.pp++; }
    else if (m.homeScore < m.awayScore) { a.pg++; a.pts += 3; h.pp++; }
    else { h.pe++; h.pts++; a.pe++; a.pts++; }
  }

  for (const s of Object.values(map)) s.dg = s.gf - s.gc;

  return Object.values(map).sort((a, b) =>
    b.pts - a.pts || b.dg - a.dg || b.gf - a.gf
  );
}

export default function GroupStandings({ groupName, teams, matches }: Props) {
  const standings = computeStandings(teams, matches);

  return (
    <div class="glass-card overflow-hidden sticky top-24">
      <div class="px-4 py-3 border-b border-accent-border/20">
        <span class="font-barlow font-black uppercase tracking-wider text-sm text-white">
          Grupo {groupName}
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-accent-border/10">
              <th class="text-left px-4 py-2 text-muted font-semibold uppercase tracking-wider w-6">#</th>
              <th class="text-left px-2 py-2 text-muted font-semibold uppercase tracking-wider">Equipo</th>
              <th class="text-center px-2 py-2 text-muted font-semibold uppercase tracking-wider">PJ</th>
              <th class="text-center px-2 py-2 text-muted font-semibold uppercase tracking-wider">DG</th>
              <th class="text-center px-2 py-2 text-muted font-semibold uppercase tracking-wider">GF</th>
              <th class="text-center px-2 py-2 text-gold font-semibold uppercase tracking-wider">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr
                key={s.team.id}
                class={`border-b border-accent-border/10 last:border-0 transition-colors ${i < 2 ? "hover:bg-accent/5" : "hover:bg-zinc-800/30"}`}
              >
                <td class="px-4 py-2.5">
                  <span class={`font-barlow font-black text-sm ${i < 2 ? "text-accent" : "text-muted"}`}>
                    {i + 1}
                  </span>
                </td>
                <td class="px-2 py-2.5">
                  <div class="flex items-center gap-2">
                    {s.team.flag ? (
                      <div class="w-6 aspect-[3/2] shrink-0 overflow-hidden">
                        <img src={s.team.flag} alt="" class="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div class="w-6 h-4 rounded bg-zinc-800 shrink-0" />
                    )}
                    <span class="font-semibold text-white text-[11px] uppercase tracking-wide">
                      {s.team.fifaCode ?? s.team.name.slice(0, 3)}
                    </span>
                  </div>
                </td>
                <td class="text-center px-2 py-2.5 text-muted tabular-nums">{s.pj}</td>
                <td class={`text-center px-2 py-2.5 tabular-nums font-semibold ${s.dg > 0 ? "text-green-400" : s.dg < 0 ? "text-red-400" : "text-muted"}`}>
                  {s.dg > 0 ? `+${s.dg}` : s.dg}
                </td>
                <td class="text-center px-2 py-2.5 text-muted tabular-nums">{s.gf}</td>
                <td class="text-center px-2 py-2.5">
                  <span class="font-barlow font-black text-sm text-gold tabular-nums">{s.pts}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Qualified indicator */}
      <div class="px-4 py-2 border-t border-accent-border/10 flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-accent/60" />
        <span class="text-[10px] text-muted uppercase tracking-wider">Clasifican top 2</span>
      </div>
    </div>
  );
}
