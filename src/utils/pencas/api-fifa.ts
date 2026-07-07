const FIFA_BASE = "https://api.fifa.com/api/v3";

export type FifaLocale<T = string> = {
  Locale: string;
  Description: T;
};

export type FifaTeam = {
  Score: number;
  Side: number | null;
  IdTeam: string;
  PictureUrl: string;
  IdCountry: string;
  TeamType: number;
  AgeType: number;
  Tactics: string;
  TeamName: FifaLocale[];
  Abbreviation: string;
  Coaches: FifaCoach[];
  Players: FifaPlayer[];
  Bookings: FifaBooking[];
  Goals: FifaGoal[];
  Substitutions: FifaSubstitution[];
};

export type FifaPlayer = {
  IdPlayer: string;
  IdTeam: string;
  ShirtNumber: number;
  Status: number;
  SpecialStatus: string | null;
  Captain: boolean;
  PlayerName: FifaLocale[];
  ShortName: FifaLocale[];
  Position: number;
  PlayerPicture: {
    Id: string;
    PictureUrl: string;
  } | null;
  FieldStatus: number;
  LineupX: number | null;
  LineupY: number | null;
};

export type FifaCoach = {
  IdCoach: string;
  IdCountry: string;
  PictureUrl: string | null;
  Name: FifaLocale[];
  Alias: FifaLocale[];
  Role: number;
  SpecialStatus: string | null;
};

export type FifaBooking = {
  Card: number;
  Period: number;
  IdEvent: string | null;
  EventNumber: string | null;
  IdPlayer: string | null;
  IdCoach: string | null;
  IdStaff: string | null;
  IdTeam: string;
  Minute: string;
  Reason: string | null;
};

export type FifaGoal = {
  Type: number;
  IdPlayer: string;
  Minute: string;
  IdAssistPlayer: string | null;
  Period: number;
  IdGoal: string | null;
  IdTeam: string;
};

export type FifaSubstitution = {
  IdPlayerIn: string;
  IdPlayerOut: string;
  IdTeam: string;
  Minute: string;
  Period: number;
};

export type FifaMatch = {
  IdMatch: string;
  IdStage: string;
  IdGroup: string | null;
  IdSeason: string;
  IdCompetition: string;
  CompetitionName: FifaLocale[];
  SeasonName: FifaLocale[];
  Stadium: {
    IdStadium: string;
    Name: FifaLocale[];
    CityName: FifaLocale[];
    IdCountry: string;
  } | null;
  ResultType: number;
  MatchDay: number | null;
  MatchNumber: number | null;
  HomeTeamPenaltyScore: number | null;
  AwayTeamPenaltyScore: number | null;
  Attendance: number | null;
  Date: string;
  LocalDate: string;
  MatchTime: string;
  SecondHalfTime: string | null;
  FirstHalfTime: string | null;
  Winner: string | null;
  Period: number;
  HomeTeam: FifaTeam;
  AwayTeam: FifaTeam;
  MatchStatus: number;
  StageName: FifaLocale[];
  TimeDefined: boolean;
};

export type FifaTimelineEvent = {
  EventId: string;
  IdTeam?: string;
  IdPlayer?: string;
  IdSubPlayer?: string;
  IdSubTeam?: string;
  IdPerson?: string;
  Timestamp: string;
  MatchMinute: string;
  Period: number;
  HomeGoals: number;
  AwayGoals: number;
  Type: number;
  Qualifiers: unknown[];
  TypeLocalized: FifaLocale[];
  PositionX?: number;
  PositionY?: number;
  GoalGatePositionX?: number;
  GoalGatePositionY?: number;
  HomePenaltyGoals: number;
  AwayPenaltyGoals: number;
  EventDescription: FifaLocale[];
};

export type FifaTimeline = {
  IdStage: string;
  IdMatch: string;
  IdCompetition: string;
  IdSeason: string;
  IdGroup: string | null;
  Event: FifaTimelineEvent[];
};

export type LiveFeedData = {
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

export type LiveFeedEvent = {
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

const EVENT_TYPE_MAP: Record<number, string> = {
  0: "Gol",
  1: "Asistencia",
  2: "Tarjeta amarilla",
  3: "Tarjeta roja",
  4: "Segunda tarjeta amarilla",
  5: "Penal fallado",
  6: "Penal señalado",
  7: "Inicio de tiempo",
  8: "Fin de primer tiempo",
  9: "Inicio segundo tiempo",
  10: "Fin del partido",
  11: "Fin del primer tiempo extra",
  12: "Remate a puerta",
  13: "Remate fuera",
  14: "Remate bloqueado",
  15: "Fuera de juego",
  16: "Saque de esquina",
  17: "Saque lateral",
  18: "Falta",
  19: "Saque de arco",
  20: "Penal para",
  57: "Parada",
  79: "Reanudación",
  83: "Pausa",
};

function getLocalized<T>(items: FifaLocale<T>[], preferredLocale = "es-ES"): T | string {
  if (!items || items.length === 0) return "";
  const preferred = items.find((i) => i.Locale === preferredLocale);
  if (preferred) return preferred.Description;
  const en = items.find((i) => i.Locale.startsWith("en"));
  if (en) return en.Description;
  return items[0].Description;
}

function mapEventType(type: number): string {
  return EVENT_TYPE_MAP[type] ?? `Evento (${type})`;
}

export async function fetchFifaMatch(idMatch: string, language = "es"): Promise<FifaMatch> {
  const url = `${FIFA_BASE}/matches/${idMatch}?language=${language}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`FIFA API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchFifaTimeline(idMatch: string, language = "es"): Promise<FifaTimeline> {
  const url = `${FIFA_BASE}/timelines/${idMatch}?language=${language}`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`FIFA API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchLiveFeed(idMatch: string, language = "es"): Promise<LiveFeedData> {
  let match: FifaMatch | null = null;
  let calendarMatch: FifaCalendarMatch | null = null;

  const timeline = await fetchFifaTimeline(idMatch, language);

  try {
    match = await fetchFifaMatch(idMatch, language);
  } catch {
    const calendarMatches = await fetchFifaCalendarMatches(language);
    calendarMatch = calendarMatches.find((m) => m.IdMatch === idMatch) ?? null;
  }

  const events: LiveFeedEvent[] = timeline.Event.map((e) => ({
    id: e.EventId,
    minute: e.MatchMinute,
    type: e.Type,
    typeName: mapEventType(e.Type),
    description: getLocalized(e.EventDescription, `${language}-ES`) || getLocalized(e.TypeLocalized, `${language}-ES`),
    teamId: e.IdTeam,
    playerId: e.IdPlayer,
    homeGoals: e.HomeGoals,
    awayGoals: e.AwayGoals,
  }));

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  if (match) {
    return {
      matchTime: match.MatchTime,
      period: match.Period,
      matchStatus: match.MatchStatus,
      homeScore: match.HomeTeam.Score,
      awayScore: match.AwayTeam.Score,
      homeTeamName: getLocalized(match.HomeTeam.TeamName, `${language}-ES`) || match.HomeTeam.Abbreviation,
      awayTeamName: getLocalized(match.AwayTeam.TeamName, `${language}-ES`) || match.AwayTeam.Abbreviation,
      homeTeamAbbr: match.HomeTeam.Abbreviation,
      awayTeamAbbr: match.AwayTeam.Abbreviation,
      homeTeamTactics: match.HomeTeam.Tactics,
      awayTeamTactics: match.AwayTeam.Tactics,
      events,
    };
  }

  if (calendarMatch) {
    const matchTime = calendarMatch.MatchTime || "";
    return {
      matchTime,
      period: calendarMatch.Period,
      matchStatus: calendarMatch.MatchStatus,
      homeScore: lastEvent?.homeGoals ?? calendarMatch.Home?.Score ?? 0,
      awayScore: lastEvent?.awayGoals ?? calendarMatch.Away?.Score ?? 0,
      homeTeamName: getLocalized(calendarMatch.Home?.TeamName ?? [], `${language}-ES`) || calendarMatch.Home?.Abbreviation || "",
      awayTeamName: getLocalized(calendarMatch.Away?.TeamName ?? [], `${language}-ES`) || calendarMatch.Away?.Abbreviation || "",
      homeTeamAbbr: calendarMatch.Home?.Abbreviation || "",
      awayTeamAbbr: calendarMatch.Away?.Abbreviation || "",
      homeTeamTactics: "",
      awayTeamTactics: "",
      events,
    };
  }

  return {
    matchTime: "",
    period: 0,
    matchStatus: 0,
    homeScore: lastEvent?.homeGoals ?? 0,
    awayScore: lastEvent?.awayGoals ?? 0,
    homeTeamName: "",
    awayTeamName: "",
    homeTeamAbbr: "",
    awayTeamAbbr: "",
    homeTeamTactics: "",
    awayTeamTactics: "",
    events,
  };
}

export type FifaCalendarMatch = {
  IdMatch: string;
  IdStage: string;
  IdGroup: string | null;
  IdSeason: string;
  IdCompetition: string;
  Date: string;
  LocalDate: string;
  MatchTime: string;
  Period: number;
  MatchStatus: number;
  StageName?: FifaLocale[];
  Home?: {
    IdTeam: string;
    Abbreviation: string;
    TeamName: FifaLocale[];
    Score: number;
  };
  Away?: {
    IdTeam: string;
    Abbreviation: string;
    TeamName: FifaLocale[];
    Score: number;
  };
  HomeTeam?: {
    IdTeam: string;
    Abbreviation: string;
    TeamName: FifaLocale[];
    Score: number;
  };
  AwayTeam?: {
    IdTeam: string;
    Abbreviation: string;
    TeamName: FifaLocale[];
    Score: number;
  };
};

export async function fetchFifaCalendarMatches(language = "es"): Promise<FifaCalendarMatch[]> {
  const url = `${FIFA_BASE}/calendar/matches?language=${language}&count=200&idCompetition=17&idSeason=285023`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`FIFA API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  const allMatches: FifaCalendarMatch[] = data.Results ?? [];

  console.log(`[fifa-calendar] WC2026 matches returned: ${allMatches.length}`);
  for (const m of allMatches.slice(0, 5)) {
    console.log(`[fifa-calendar]   ${m.Home?.Abbreviation} vs ${m.Away?.Abbreviation} on ${m.Date} (id=${m.IdMatch})`);
  }

  return allMatches;
}

export function getHomeAbbr(m: FifaCalendarMatch): string | undefined {
  return m.Home?.Abbreviation ?? m.HomeTeam?.Abbreviation;
}

export function getAwayAbbr(m: FifaCalendarMatch): string | undefined {
  return m.Away?.Abbreviation ?? m.AwayTeam?.Abbreviation;
}

export function matchFifaIdByTeamsAndDate(
  fifaMatches: FifaCalendarMatch[],
  homeAbbr: string,
  awayAbbr: string,
  matchDate: string,
): string | null {
  const targetDate = new Date(matchDate);
  const targetDateStr = targetDate.toISOString().slice(0, 10);
  const home = homeAbbr?.toUpperCase();
  const away = awayAbbr?.toUpperCase();

  for (const fm of fifaMatches) {
    const fmDate = new Date(fm.Date).toISOString().slice(0, 10);
    if (fmDate !== targetDateStr) continue;

    const fmHome = getHomeAbbr(fm)?.toUpperCase();
    const fmAway = getAwayAbbr(fm)?.toUpperCase();

    if ((fmHome === home && fmAway === away) || (fmHome === away && fmAway === home)) {
      return fm.IdMatch;
    }
  }

  return null;
}

export function searchFifaMatches(
  fifaMatches: FifaCalendarMatch[],
  homeAbbr: string,
  awayAbbr: string,
): FifaCalendarMatch[] {
  const home = homeAbbr?.toUpperCase();
  const away = awayAbbr?.toUpperCase();

  return fifaMatches.filter((fm) => {
    const fmHome = getHomeAbbr(fm)?.toUpperCase();
    const fmAway = getAwayAbbr(fm)?.toUpperCase();
    return (fmHome === home && fmAway === away) || (fmHome === away && fmAway === home);
  });
}

export function debugFifaMatching(
  fifaMatches: FifaCalendarMatch[],
  dbMatches: Array<{ id: number; homeAbbr: string; awayAbbr: string; matchDate: string }>,
): void {
  console.log(`[fifa-debug] Total FIFA calendar matches: ${fifaMatches.length}`);

  const wc2026 = fifaMatches.filter((m) => {
    const year = new Date(m.Date).getFullYear();
    return year === 2026;
  });
  console.log(`[fifa-debug] FIFA matches in 2026: ${wc2026.length}`);

  if (wc2026.length > 0) {
    console.log(`[fifa-debug] Sample 2026 FIFA match: ${getHomeAbbr(wc2026[0])} vs ${getAwayAbbr(wc2026[0])} on ${wc2026[0].Date} (id=${wc2026[0].IdMatch})`);
  }

  const fifaByCode = new Map<string, number>();
  for (const fm of fifaMatches) {
    const code = getHomeAbbr(fm)?.toUpperCase();
    if (code) fifaByCode.set(code, (fifaByCode.get(code) ?? 0) + 1);
  }
  console.log(`[fifa-debug] FIFA home team codes (first 10):`, [...fifaByCode.entries()].slice(0, 10).map(([k, v]) => `${k}(${v})`).join(', '));

  if (dbMatches.length > 0) {
    const first = dbMatches[0];
    console.log(`[fifa-debug] First DB match: id=${first.id} ${first.homeAbbr} vs ${first.awayAbbr} on ${first.matchDate}`);
    const targetDate = new Date(first.matchDate).toISOString().slice(0, 10);
    console.log(`[fifa-debug] Parsed DB date: ${targetDate}`);

    const fifaOnDate = fifaMatches.filter((m) => {
      const fmDate = new Date(m.Date).toISOString().slice(0, 10);
      return fmDate === targetDate;
    });
    console.log(`[fifa-debug] FIFA matches on ${targetDate}: ${fifaOnDate.length}`);
    for (const fm of fifaOnDate.slice(0, 5)) {
      console.log(`[fifa-debug]   ${getHomeAbbr(fm)} vs ${getAwayAbbr(fm)} (${fm.IdMatch})`);
    }

    const fifaWithHome = fifaMatches.filter((m) => getHomeAbbr(m)?.toUpperCase() === first.homeAbbr?.toUpperCase());
    console.log(`[fifa-debug] FIFA matches with home=${first.homeAbbr}: ${fifaWithHome.length}`);
    for (const fm of fifaWithHome.slice(0, 5)) {
      console.log(`[fifa-debug]   vs ${getAwayAbbr(fm)} on ${fm.Date} (${fm.IdMatch})`);
    }
  }
}
