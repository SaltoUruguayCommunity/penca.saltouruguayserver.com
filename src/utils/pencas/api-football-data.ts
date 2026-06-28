const BASE_URL = "https://api.football-data.org/v4";

function getHeaders(): Record<string, string> {
  const apiKey = import.meta.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY is not set");
  return { "X-Auth-Token": apiKey };
}

type ApiCompetition = {
  id: number;
  name: string;
  code: string;
};

type ApiTeam = {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
};

type ApiArea = {
  id: number;
  name: string;
  code: string;
  flag: string;
};

type ApiSeason = {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number;
};

type ApiGroupStanding = {
  stage: string;
  type: string;
  group: string | null;
  table: Array<{
    position: number;
    team: ApiTeam;
    playedGames: number;
    won: number;
    draw: number;
    lost: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
  }>;
};

type ApiStandingsResponse = {
  filters: Record<string, unknown>;
  area: ApiArea;
  competition: ApiCompetition;
  season: ApiSeason;
  standings: ApiGroupStanding[];
};

type ApiMatch = {
  id: number;
  competition: ApiCompetition;
  season: ApiSeason;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: {
    winner: string | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
};

type ApiMatchesResponse = {
  filters: Record<string, unknown>;
  resultSet: { count: number; competitions: string; first: string; last: string };
  competition: ApiCompetition;
  matches: ApiMatch[];
};

export async function fetchCompetitionStandings(
  competitionCode = "WC",
): Promise<ApiStandingsResponse> {
  const res = await fetch(
    `${BASE_URL}/competitions/${competitionCode}/standings`,
    { headers: getHeaders() },
  );
  if (!res.ok) {
    throw new Error(`football-data.org API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchCompetitionMatches(
  competitionCode = "WC",
  options?: { matchday?: number; stage?: string },
): Promise<ApiMatchesResponse> {
  const params = new URLSearchParams();
  if (options?.matchday) params.set("matchday", String(options.matchday));
  if (options?.stage) params.set("stage", options.stage);

  const url = `${BASE_URL}/competitions/${competitionCode}/matches${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`football-data.org API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: "group",
  LAST_32: "last_32",
  ROUND_OF_16: "round_of_16",
  QUARTER_FINALS: "quarter_final",
  SEMI_FINALS: "semi_final",
  THIRD_PLACE: "third_place",
  FINAL: "final",
};

const STATUS_MAP: Record<string, string> = {
  SCHEDULED: "scheduled",
  TIMED: "scheduled",
  IN_PLAY: "live",
  PAUSED: "live",
  FINISHED: "finished",
  POSTPONED: "scheduled",
  CANCELLED: "scheduled",
};

export function mapStage(apiStage: string): string {
  return STAGE_MAP[apiStage] ?? apiStage.toLowerCase();
}

export function mapStatus(apiStatus: string): string {
  return STATUS_MAP[apiStatus] ?? "scheduled";
}
