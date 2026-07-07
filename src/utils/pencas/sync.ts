import { and, eq, sql } from "drizzle-orm";
import { client } from "../../db";
import {
  WcMatchesTable,
  WcTeamsTable,
  WcPredictionsTable,
  SyncMetadataTable,
} from "../../db/schema";
import {
  fetchCompetitionMatches,
  mapStage,
  mapStatus,
} from "./api-football-data";
import { calcPoints } from "./scoring";
import { rewardExactScore } from "./rewards";

const STAGES = [
  "group",
  "last_32",
  "last_16",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
] as const;

async function recalculateMatchPoints(matchId: number) {
  const match = await client.query.WcMatchesTable.findFirst({
    where: eq(WcMatchesTable.id, matchId),
  });
  if (!match || match.homeScore === null || match.awayScore === null) return;

  const predictions = await client
    .select()
    .from(WcPredictionsTable)
    .where(eq(WcPredictionsTable.matchId, matchId))
    .all();

  for (const pred of predictions) {
    const points = calcPoints(
      pred.homeScore,
      pred.awayScore,
      match.homeScore,
      match.awayScore,
    );

    await client
      .update(WcPredictionsTable)
      .set({ points, updatedAt: sql`(current_timestamp)` })
      .where(eq(WcPredictionsTable.id, pred.id))
      .run();

    if (points === 5) {
      await rewardExactScore(pred.userId);
    }
  }
}

export async function syncScoresFromApi(): Promise<{ updated: number }> {
  const [matchesRes, teams] = await Promise.all([
    fetchCompetitionMatches("WC"),
    client.select().from(WcTeamsTable).all(),
  ]);

  const teamByCode = new Map(teams.map((t) => [t.fifaCode, t.id]));
  const relevantStatuses = new Set(["IN_PLAY", "PAUSED", "FINISHED"]);
  const apiScored = matchesRes.matches.filter((m) => {
    if (!relevantStatuses.has(m.status)) return false;
    if (m.status === "FINISHED" && (m.score.fullTime.home === null || m.score.fullTime.away === null)) return false;
    return true;
  });

  console.log("[cron] syncScoresFromApi: API total:", matchesRes.matches.length, "| filtered:", apiScored.length, "| teams in DB:", teams.length);

  let updated = 0;

  for (const apiMatch of apiScored) {
    const homeTeamId = teamByCode.get(apiMatch.homeTeam.tla);
    const awayTeamId = teamByCode.get(apiMatch.awayTeam.tla);
    if (!homeTeamId || !awayTeamId) {
      console.log("[cron] SKIP — team not found:", apiMatch.homeTeam.tla, "vs", apiMatch.awayTeam.tla);
      continue;
    }

    const apiStage = mapStage(apiMatch.stage);
    const dbMatch = await client
      .select()
      .from(WcMatchesTable)
      .where(
        and(
          eq(WcMatchesTable.homeTeamId, homeTeamId),
          eq(WcMatchesTable.awayTeamId, awayTeamId),
          eq(WcMatchesTable.stage, apiStage),
        ),
      )
      .get();

    if (!dbMatch) {
      console.log("[cron] SKIP — match not found in DB:", apiMatch.homeTeam.tla, "vs", apiMatch.awayTeam.tla, "| stage:", apiStage, "| date:", apiMatch.utcDate);
      continue;
    }

    const newStatus = mapStatus(apiMatch.status);
    if (dbMatch.status === "finished" && newStatus !== "finished") {
      console.log("[cron] SKIP — won't revert finished match:", apiMatch.homeTeam.tla, "vs", apiMatch.awayTeam.tla);
      continue;
    }
    if (dbMatch.homeScore === apiMatch.score.fullTime.home && dbMatch.awayScore === apiMatch.score.fullTime.away && dbMatch.status === newStatus) {
      console.log("[cron] SKIP — already up to date:", apiMatch.homeTeam.tla, "vs", apiMatch.awayTeam.tla, "| DB:", dbMatch.homeScore, "-", dbMatch.awayScore, dbMatch.status, "| API:", apiMatch.score.fullTime.home, "-", apiMatch.score.fullTime.away, newStatus);
      continue;
    }

    console.log("[cron] UPDATE:", apiMatch.homeTeam.tla, "vs", apiMatch.awayTeam.tla, "| DB:", dbMatch.homeScore, "-", dbMatch.awayScore, dbMatch.status, "→ API:", apiMatch.score.fullTime.home, "-", apiMatch.score.fullTime.away, newStatus);

    const hasScores = apiMatch.score.fullTime.home !== null && apiMatch.score.fullTime.away !== null;
    const setValues: Record<string, unknown> = {
      status: newStatus,
      updatedAt: sql`(current_timestamp)`,
    };
    if (hasScores) {
      setValues.homeScore = apiMatch.score.fullTime.home;
      setValues.awayScore = apiMatch.score.fullTime.away;
    }
    await client
      .update(WcMatchesTable)
      .set(setValues)
      .where(eq(WcMatchesTable.id, dbMatch.id))
      .run();

    if (newStatus === "finished" && dbMatch.status !== "finished") {
      await recalculateMatchPoints(dbMatch.id);
    }

    updated++;
  }

  console.log("[cron] syncScoresFromApi: updated:", updated);
  return { updated };
}

export async function autoImportNextStage(): Promise<{
  imported: number;
  stage: string | null;
}> {
  const stages = await client
    .select({ stage: WcMatchesTable.stage })
    .from(WcMatchesTable)
    .groupBy(WcMatchesTable.stage)
    .all();

  const presentStages = new Set(stages.map((s) => s.stage));
  console.log("[sync] autoImportNextStage: present stages in DB:", [...presentStages]);

  for (let i = 0; i < STAGES.length - 1; i++) {
    const current = STAGES[i];
    const next = STAGES[i + 1];

    if (!presentStages.has(current)) continue;
    if (presentStages.has(next)) continue;

    const total = await client
      .select({ count: sql<number>`COUNT(*)` })
      .from(WcMatchesTable)
      .where(eq(WcMatchesTable.stage, current))
      .get();

    const finished = await client
      .select({ count: sql<number>`COUNT(*)` })
      .from(WcMatchesTable)
      .where(
        and(
          eq(WcMatchesTable.stage, current),
          eq(WcMatchesTable.status, "finished"),
        ),
      )
      .get();

    console.log(`[sync] autoImportNextStage: ${current} → total: ${total?.count}, finished: ${finished?.count}`);

    if (!total || !finished || total.count === 0) continue;
    if (total.count !== finished.count) continue;

    console.log(`[sync] autoImportNextStage: ${current} stage complete, importing ${next}...`);

    const allMatches = await fetchCompetitionMatches("WC");

    const nextStageMatches = allMatches.matches.filter(
      (m) => mapStage(m.stage) === next
    );

    console.log(`[sync] autoImportNextStage: API returned ${allMatches.matches.length} total, ${nextStageMatches.length} for ${next}`);

    if (nextStageMatches.length === 0) {
      console.log(`[sync] autoImportNextStage: no ${next} matches available in API yet, will retry next sync`);
      return { imported: 0, stage: null };
    }

    const allTeams = await client.select().from(WcTeamsTable).all();
    const teamMap = new Map(allTeams.map((t) => [t.fifaCode, t.id]));

    let imported = 0;

    for (const match of nextStageMatches) {
      const homeTeamId = teamMap.get(match.homeTeam.tla);
      const awayTeamId = teamMap.get(match.awayTeam.tla);

      if (!homeTeamId || !awayTeamId) {
        console.log(`[sync] autoImportNextStage: SKIP team not found: ${match.homeTeam.tla} vs ${match.awayTeam.tla}`);
        continue;
      }

      const existing = await client
        .select()
        .from(WcMatchesTable)
        .where(
          and(
            eq(WcMatchesTable.homeTeamId, homeTeamId),
            eq(WcMatchesTable.awayTeamId, awayTeamId),
            eq(WcMatchesTable.stage, mapStage(match.stage)),
          ),
        )
        .get();

      if (!existing) {
        await client
          .insert(WcMatchesTable)
          .values({
            groupId: null,
            homeTeamId,
            awayTeamId,
            matchDate: match.utcDate,
            stage: mapStage(match.stage),
            status: mapStatus(match.status),
            homeScore: match.score.fullTime.home,
            awayScore: match.score.fullTime.away,
          })
          .run();
        imported++;
        console.log(`[sync] autoImportNextStage: INSERTED ${match.homeTeam.tla} vs ${match.awayTeam.tla} (${mapStage(match.stage)})`);
      }
    }

    console.log(`[sync] autoImportNextStage: done — imported ${imported} ${next} matches`);
    return { imported, stage: next };
  }

  return { imported: 0, stage: null };
}

const STAGE_TO_API: Record<string, string> = {
  group: "GROUP_STAGE",
  last_32: "LAST_32",
  last_16: "LAST_16",
  round_of_16: "ROUND_OF_16",
  quarter_final: "QUARTER_FINALS",
  semi_final: "SEMI_FINALS",
  third_place: "THIRD_PLACE",
  final: "FINAL",
};

export async function runFullSync(): Promise<{
  scoresUpdated: number;
  autoImported: number;
  nextStage: string | null;
}> {
  const { updated: scoresUpdated } = await syncScoresFromApi();
  const { imported: autoImported, stage: nextStage } = await autoImportNextStage();

  // Update last synced timestamp
  const metadata = await client
    .select()
    .from(SyncMetadataTable)
    .get();

  if (metadata) {
    await client
      .update(SyncMetadataTable)
      .set({
        lastSyncedAt: sql`(current_timestamp)`,
        updatedAt: sql`(current_timestamp)`,
      })
      .where(eq(SyncMetadataTable.id, metadata.id))
      .run();
  } else {
    await client
      .insert(SyncMetadataTable)
      .values({
        lastSyncedAt: sql`(current_timestamp)`,
      })
      .run();
  }

  return { scoresUpdated, autoImported, nextStage };
}
