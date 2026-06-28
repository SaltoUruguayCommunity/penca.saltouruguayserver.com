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
  knockoutMatches: Match[];
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

const STAGE_LABELS: Record<string, string> = {
  group: "Grupo",
  last_32: "32avos",
  round_of_16: "16avos",
  quarter_final: "Cuartos",
  semi_final: "Semifinal",
  third_place: "3er Puesto",
  final: "Final",
};

function MatchRow(props: { m: Match & { groupName: string } }) {
  const m = props.m;
  const url = "/matches/" + m.id;
  const rowClass = "flex items-center gap-3 px-4 py-3 transition-colors group";
  const homeFlag = m.homeTeam.flag || "";
  const awayFlag = m.awayTeam.flag || "";

  const stageLabel = m.groupName
    ? `Grupo ${m.groupName}`
    : STAGE_LABELS[m.stage] ?? m.stage;

  return (
    <a href={url} class={rowClass}>
      <div class="w-24 shrink-0">
        <p class="text-xs font-bold text-accent-light">
          {formatTime(m.matchDate)}
        </p>
        <p class="text-xs text-muted uppercase">
          {stageLabel}
        </p>
      </div>
      <div class="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span class="text-sm font-semibold text-white truncate text-right">
          {m.homeTeam.name}
        </span>
        {homeFlag && (
          <img src={homeFlag} alt="" class="w-7 h-5 object-cover shrink-0" />
        )}
      </div>
      <div class="shrink-0 mx-1">
        <span class="text-sm text-muted px-1">vs</span>
      </div>
      <div class="flex items-center gap-2 flex-1 min-w-0">
        {awayFlag && (
          <img src={awayFlag} alt="" class="w-7 h-5 object-cover shrink-0" />
        )}
        <span class="text-sm font-semibold text-white truncate">
          {m.awayTeam.name}
        </span>
      </div>
      <div class="shrink-0 text-right">
        <span class="text-xs font-bold text-accent uppercase">
          Pronosticar
        </span>
      </div>
    </a>
  );
}

export default function TodayMatches(props: { groups: Group[]; knockoutMatches: Match[] }) {
  const groups = props.groups;
  const now = new Date();
  const todayStr = now.toDateString();

  const groupMatches = groups
    .flatMap(function(g) {
      return g.matches.map(function(m) {
        return Object.assign({}, m, { groupName: g.name });
      });
    });
  const knockoutToday = props.knockoutMatches.map(function(m) {
    return Object.assign({}, m, { groupName: "" });
  });
  const todayMatches = [...groupMatches, ...knockoutToday]
    .filter(function(m) {
      const matchDate = new Date(m.matchDate);
      return matchDate.toDateString() === todayStr
        && m.status === "scheduled"
        && matchDate > now;
    })
    .sort(function(a, b) {
      return new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime();
    });

  if (todayMatches.length === 0) {
    return null;
  }

  const count = todayMatches.length;
  const label = count !== 1 ? "s" : "";

  return (
    <div class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span>📅</span>
          <h2 class="font-barlow font-bold uppercase text-sm text-white tracking-wider">
            Partidos de hoy
          </h2>
        </div>
        <span class="text-xs text-muted uppercase">
          {count} partido{label}
        </span>
      </div>
      <div class="glass-card overflow-hidden divide-y divide-accent-border/15">
        {todayMatches.map(function(m) {
          return <MatchRow m={m} />;
        })}
      </div>
    </div>
  );
}