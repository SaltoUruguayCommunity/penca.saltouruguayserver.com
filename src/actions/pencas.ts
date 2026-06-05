import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { and, desc, eq, lte, ne, sql } from "drizzle-orm";
import { getSession } from "auth-astro/server";
import { client, turso } from "../db";
import {
  WcGroupsTable,
  WcMatchesTable,
  WcPredictionsTable,
  WcTeamsTable,
  UsersTable,
} from "../db/schema";
import { calcPoints } from "../utils/pencas/scoring";
import { rewardPrediction, rewardExactScore } from "../utils/pencas/rewards";
import { syncScoresFromApi } from "../utils/pencas/sync";
import {
  fetchCompetitionStandings,
  fetchCompetitionMatches,
  mapStage,
  mapStatus,
} from "../utils/pencas/api-football-data";

const STAGES = [
  "group",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
] as const;

export const pencas = {
  getGroups: defineAction({
    handler: async () => {
      const groups = await client.query.WcGroupsTable.findMany({
        orderBy: [WcGroupsTable.name],
        with: {
          teams: {
            columns: { id: true, name: true, flag: true, fifaCode: true },
          },
          matches: {
            with: {
              homeTeam: { columns: { id: true, name: true, flag: true } },
              awayTeam: { columns: { id: true, name: true, flag: true } },
            },
            orderBy: [WcMatchesTable.matchDate],
          },
        },
      });

      return groups.map((g) => ({
        id: g.id,
        name: g.name,
        teams: g.teams,
        matches: g.matches.map((m) => ({
          id: m.id,
          matchDate: m.matchDate,
          stage: m.stage,
          status: m.status,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
        })),
      }));
    },
  }),

  getMatches: defineAction({
    input: z.object({
      groupId: z.number().optional(),
      stage: z.enum(STAGES).optional(),
    }),
    handler: async ({ groupId, stage }) => {
      const conditions = [];
      if (groupId) conditions.push(eq(WcMatchesTable.groupId, groupId));
      if (stage) conditions.push(eq(WcMatchesTable.stage, stage));

      const matches = await client.query.WcMatchesTable.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          homeTeam: { columns: { id: true, name: true, flag: true } },
          awayTeam: { columns: { id: true, name: true, flag: true } },
        },
        orderBy: [WcMatchesTable.matchDate],
      });

      return matches;
    },
  }),

  submitPrediction: defineAction({
    input: z.object({
      matchId: z.number(),
      homeScore: z.number().int().min(0).max(50),
      awayScore: z.number().int().min(0).max(50),
    }),
    handler: async ({ matchId, homeScore, awayScore }, { request }) => {
      const session = await getSession(request);
      if (!session?.user?.id) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para pronosticar",
        });
      }

      const match = await client.query.WcMatchesTable.findFirst({
        where: eq(WcMatchesTable.id, matchId),
      });
      if (!match) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Partido no encontrado",
        });
      }

      const matchDate = new Date(match.matchDate);
      if (matchDate <= new Date() || match.status === "live" || match.status === "finished") {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "El partido ya comenzó o finalizó",
        });
      }

      await client
        .insert(WcPredictionsTable)
        .values({
          userId: session.user.id,
          matchId,
          homeScore,
          awayScore,
        })
        .onConflictDoUpdate({
          target: [WcPredictionsTable.userId, WcPredictionsTable.matchId],
          set: { homeScore, awayScore, updatedAt: sql`(current_timestamp)` },
        })
        .run();

      await rewardPrediction(session.user.id);

      return { success: true };
    },
  }),

  getPredictions: defineAction({
    input: z.object({
      matchId: z.number().optional(),
    }),
    handler: async ({ matchId }, { request }) => {
      const session = await getSession(request);
      if (!session?.user?.id) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión",
        });
      }

      const conditions = [eq(WcPredictionsTable.userId, session.user.id)];
      if (matchId) conditions.push(eq(WcPredictionsTable.matchId, matchId));

      return client.query.WcPredictionsTable.findMany({
        where: and(...conditions),
      });
    },
  }),

  getMatchDetail: defineAction({
    input: z.object({
      matchId: z.number(),
    }),
    handler: async ({ matchId }) => {
      const match = await client.query.WcMatchesTable.findFirst({
        where: eq(WcMatchesTable.id, matchId),
        with: {
          homeTeam: { columns: { id: true, name: true, flag: true } },
          awayTeam: { columns: { id: true, name: true, flag: true } },
          group: { columns: { id: true, name: true } },
        },
      });
      if (!match) {
        throw new ActionError({ code: "NOT_FOUND", message: "Partido no encontrado" });
      }

      const predictions = await client
        .select({
          userId: WcPredictionsTable.userId,
          username: UsersTable.username,
          avatar: UsersTable.avatar,
          homeScore: WcPredictionsTable.homeScore,
          awayScore: WcPredictionsTable.awayScore,
          points: WcPredictionsTable.points,
        })
        .from(WcPredictionsTable)
        .innerJoin(UsersTable, eq(WcPredictionsTable.userId, UsersTable.id))
        .where(eq(WcPredictionsTable.matchId, matchId))
        .all();

      return {
        match: {
          id: match.id,
          matchDate: match.matchDate,
          stage: match.stage,
          status: match.status,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          group: match.group,
        },
        predictions,
      };
    },
  }),

  getLeaderboard: defineAction({
    handler: async () => {
      const rankings = await client
        .select({
          userId: UsersTable.id,
          username: UsersTable.username,
          avatar: UsersTable.avatar,
          totalPoints: sql<number>`COALESCE(SUM(${WcPredictionsTable.points}), 0)`,
        })
        .from(WcPredictionsTable)
        .rightJoin(UsersTable, eq(WcPredictionsTable.userId, UsersTable.id))
        .groupBy(UsersTable.id, UsersTable.username, UsersTable.avatar)
        .orderBy(desc(sql`totalPoints`))
        .all();

      return rankings.map((r, i) => ({
        position: i + 1,
        userId: r.userId,
        username: r.username,
        avatar: r.avatar,
        totalPoints: Number(r.totalPoints),
      }));
    },
  }),

  getLiveMatches: defineAction({
    handler: async () => {
      const now = new Date().toISOString();
      return client.query.WcMatchesTable.findMany({
        where: and(
          ne(WcMatchesTable.status, "finished"),
          lte(WcMatchesTable.matchDate, now),
        ),
        orderBy: [WcMatchesTable.matchDate],
        with: {
          homeTeam: { columns: { id: true, name: true, flag: true } },
          awayTeam: { columns: { id: true, name: true, flag: true } },
        },
      });
    },
  }),

  admin: {
    fetchFromApi: defineAction({
      handler: async (_, { request }) => {
        await requireAdmin(request);

        const standings = await fetchCompetitionStandings("WC");
        const matchesRes = await fetchCompetitionMatches("WC");

        console.log(JSON.stringify({ standings, matchesRes }));

        function normalizeGroup(raw: string | null): string | null {
          if (!raw) return null;
          const cleaned = raw.trim().toUpperCase();
          // API returns "GROUP_A", "Group A", or just "A"
          const match = cleaned.match(/^GROUP[ _]+([A-Z])$/);
          if (match) return match[1];
          // Standings sometimes returns just the letter
          if (/^[A-Z]$/.test(cleaned)) return cleaned;
          return null;
        }

        for (const standing of standings.standings) {
          if (!standing.group) continue;

          const groupName = normalizeGroup(standing.group);
          if (!groupName) continue;

          let group = await client
            .select()
            .from(WcGroupsTable)
            .where(eq(WcGroupsTable.name, groupName))
            .get();

          if (!group) {
            await turso.execute({ sql: "INSERT INTO wc_groups (name) VALUES (?)", args: [groupName] });
            group = await client
              .select()
              .from(WcGroupsTable)
              .where(eq(WcGroupsTable.name, groupName))
              .get();
          }

          for (const entry of standing.table) {
            const existing = await client
              .select()
              .from(WcTeamsTable)
              .where(eq(WcTeamsTable.fifaCode, entry.team.tla))
              .get();

            if (!existing) {
              await client
                .insert(WcTeamsTable)
                .values({
                  groupId: group.id,
                  name: entry.team.name,
                  flag: entry.team.crest,
                  fifaCode: entry.team.tla,
                })
                .run();
            }
          }
        }

        const groupMap = new Map(
          (await client.select().from(WcGroupsTable).all()).map((g) => [g.name, g.id]),
        );
        const teamMap = new Map(
          (await client.select().from(WcTeamsTable).all()).map((t) => [t.fifaCode, t.id]),
        );

        for (const match of matchesRes.matches) {
          const homeTla = match.homeTeam.tla;
          const awayTla = match.awayTeam.tla;
          const homeTeamId = teamMap.get(homeTla);
          const awayTeamId = teamMap.get(awayTla);

          if (!homeTeamId || !awayTeamId) continue;

          const groupName = normalizeGroup(match.group);
          const groupId = groupName ? groupMap.get(groupName) ?? null : null;

          const existing = await client
            .select()
            .from(WcMatchesTable)
            .where(
              and(
                eq(WcMatchesTable.homeTeamId, homeTeamId),
                eq(WcMatchesTable.awayTeamId, awayTeamId),
                eq(WcMatchesTable.matchDate, match.utcDate),
              ),
            )
            .get();

          if (!existing) {
            await client
              .insert(WcMatchesTable)
              .values({
                groupId,
                homeTeamId,
                awayTeamId,
                matchDate: match.utcDate,
                stage: mapStage(match.stage || match.group ? "GROUP_STAGE" : ""),
                status: mapStatus(match.status),
                homeScore: match.score.fullTime.home,
                awayScore: match.score.fullTime.away,
              })
              .run();
          } else if (existing.groupId === null && groupId !== null) {
            await client
              .update(WcMatchesTable)
              .set({ groupId, updatedAt: sql`(current_timestamp)` })
              .where(eq(WcMatchesTable.id, existing.id))
              .run();
          }
        }

        return { success: true };
      },
    }),

    updateMatchScore: defineAction({
      input: z.object({
        matchId: z.number(),
        homeScore: z.number().int().min(0),
        awayScore: z.number().int().min(0),
      }),
      handler: async ({ matchId, homeScore, awayScore }, { request }) => {
        await requireAdmin(request);

        await client
          .update(WcMatchesTable)
          .set({
            homeScore,
            awayScore,
            status: "finished",
            updatedAt: sql`(current_timestamp)`,
          })
          .where(eq(WcMatchesTable.id, matchId))
          .run();

        await recalculateMatchPoints(matchId);

        return { success: true };
      },
    }),

    calculatePoints: defineAction({
      input: z.object({
        matchId: z.number(),
      }),
      handler: async ({ matchId }, { request }) => {
        await requireAdmin(request);
        await recalculateMatchPoints(matchId);
        return { success: true };
      },
    }),

    resetMatchScore: defineAction({
      input: z.object({
        matchId: z.number(),
      }),
      handler: async ({ matchId }, { request }) => {
        await requireAdmin(request);

        await client
          .update(WcPredictionsTable)
          .set({ points: null, updatedAt: sql`(current_timestamp)` })
          .where(eq(WcPredictionsTable.matchId, matchId))
          .run();

        await client
          .update(WcMatchesTable)
          .set({
            homeScore: null,
            awayScore: null,
            status: "scheduled",
            updatedAt: sql`(current_timestamp)`,
          })
          .where(eq(WcMatchesTable.id, matchId))
          .run();

        return { success: true };
      },
    }),

    syncScores: defineAction({
      handler: async (_, { request }) => {
        await requireAdmin(request);
        return await syncScoresFromApi();
      },
    }),

    checkMatches: defineAction({
      handler: async (_, { request }) => {
        await requireAdmin(request);

        const groups = await client.select().from(WcGroupsTable).all();
        const matches = await client.select().from(WcMatchesTable).all();

        const byGroup: Record<string, { total: number; withGroupId: number }> = {};
        for (const g of groups) {
          byGroup[g.name] = { total: 0, withGroupId: 0 };
        }
        byGroup["(sin grupo)"] = { total: 0, withGroupId: 0 };

        for (const m of matches) {
          const key = m.groupId ? (groups.find((g) => g.id === m.groupId)?.name ?? "(desconocido)") : "(sin grupo)";
          if (!byGroup[key]) byGroup[key] = { total: 0, withGroupId: 0 };
          byGroup[key].total++;
          if (m.groupId) byGroup[key].withGroupId++;
        }

        const totalMatches = matches.length;
        const orphaned = matches.filter((m) => !m.groupId).length;

        return { groups: byGroup, totalMatches, orphaned };
      },
    }),
  },
};

async function requireAdmin(request: Request) {
  const session = await getSession(request);
  console.log("Session in requireAdmin:", session);
  if (!session?.user?.id || !session.user.is_admin) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "No tienes permisos de administrador",
    });
  }
}

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
