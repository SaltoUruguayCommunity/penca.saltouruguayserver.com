import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { and, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { client, turso } from "../db";
import {
  WcGroupsTable,
  WcMatchesTable,
  WcPredictionsTable,
  WcTeamsTable,
  UsersTable,
} from "../db/schema";
import { calcPoints } from "../utils/pencas/scoring";
import { rewardPrediction, rewardExactScore, getStreakMilestoneBonus } from "../utils/pencas/rewards";
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
    handler: async ({ matchId, homeScore, awayScore }, { request, locals }) => {
      const { user } = locals
      if (!user?.id) {
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

      const existing = await client
        .select()
        .from(WcPredictionsTable)
        .where(
          and(
            eq(WcPredictionsTable.userId, user.id),
            eq(WcPredictionsTable.matchId, matchId),
          ),
        )
        .get();

      await client
        .insert(WcPredictionsTable)
        .values({
          userId: user.id,
          matchId,
          homeScore,
          awayScore,
        })
        .onConflictDoUpdate({
          target: [WcPredictionsTable.userId, WcPredictionsTable.matchId],
          set: { homeScore, awayScore, updatedAt: sql`(current_timestamp)` },
        })
        .run();

      if (!existing) {
        await rewardPrediction(user.id);
      }

      return { success: true };
    },
  }),

  getPredictions: defineAction({
    input: z.object({
      matchId: z.number().optional(),
    }),
    handler: async ({ matchId }, { request, locals }) => {
      const { user } = locals;
      if (!user?.id) {
        throw new ActionError({
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión",
        });
      }

      const conditions = [eq(WcPredictionsTable.userId, user.id)];
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
          streak: UsersTable.streak,
          totalPoints: sql<number>`COALESCE(SUM(${WcPredictionsTable.points}), 0)`,
        })
        .from(UsersTable)
        .leftJoin(WcPredictionsTable, eq(UsersTable.id, WcPredictionsTable.userId))
        .groupBy(UsersTable.id, UsersTable.username, UsersTable.avatar, UsersTable.streak)
        .orderBy(desc(sql`COALESCE(SUM(${WcPredictionsTable.points}), 0)`))
        .all();

      return rankings.map((r, i) => ({
        position: i + 1,
        userId: r.userId,
        username: r.username,
        avatar: r.avatar,
        streak: r.streak,
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
      handler: async (_, { request, locals }) => {
        await requireAdmin(locals);

        // 1. Fetch externo en paralelo
        const [standings, matchesRes] = await Promise.all([
          fetchCompetitionStandings("WC"),
          fetchCompetitionMatches("WC"),
        ]);

        function normalizeGroup(raw: string | null): string | null {
          if (!raw) return null;
          const cleaned = raw.trim().toUpperCase();
          const match = cleaned.match(/^GROUP[ _]+([A-Z])$/);
          if (match) return match[1];
          if (/^[A-Z]$/.test(cleaned)) return cleaned;
          return null;
        }

        // 2. Extraer grupos únicos desde standings
        const groupNames = [
          ...new Set(
            standings.standings
              .map((s) => normalizeGroup(s.group))
              .filter((g): g is string => g !== null),
          ),
        ];

        // 3. Leer grupos existentes UNA sola vez
        const existingGroups = await client.select().from(WcGroupsTable).all();
        const existingGroupNames = new Set(existingGroups.map((g) => g.name));

        // 4. Insertar grupos faltantes en UN solo batch
        const missingGroups = groupNames.filter((n) => !existingGroupNames.has(n));
        if (missingGroups.length > 0) {
          await client
            .insert(WcGroupsTable)
            .values(missingGroups.map((name) => ({ name })))
            .run();
        }

        // 5. Recargar y construir mapa (una query)
        const allGroups = await client.select().from(WcGroupsTable).all();
        const groupMap = new Map(allGroups.map((g) => [g.name, g.id]));

        // 6. Extraer equipos únicos desde standings
        const teamsToUpsert = standings.standings.flatMap((standing) => {
          const groupName = normalizeGroup(standing.group);
          const groupId = groupName ? groupMap.get(groupName) : undefined;
          if (!groupId) return [];
          return standing.table.map((entry) => ({
            fifaCode: entry.team.tla,
            name: entry.team.name,
            flag: entry.team.crest,
            groupId,
          }));
        });

        // 7. Leer equipos existentes UNA sola vez
        const existingTeams = await client.select().from(WcTeamsTable).all();
        const existingFifaCodes = new Set(existingTeams.map((t) => t.fifaCode));

        // 8. Insertar equipos faltantes en UN solo batch
        const newTeams = teamsToUpsert.filter((t) => !existingFifaCodes.has(t.fifaCode));
        if (newTeams.length > 0) {
          await client.insert(WcTeamsTable).values(newTeams).run();
        }

        // 9. Mapa de equipos actualizado (una query)
        const allTeams = await client.select().from(WcTeamsTable).all();
        const teamMap = new Map(allTeams.map((t) => [t.fifaCode, t.id]));

        // 10. Leer partidos existentes UNA sola vez
        const existingMatches = await client.select().from(WcMatchesTable).all();
        const matchKey = (homeId: number, awayId: number, date: string) =>
          `${homeId}_${awayId}_${date}`;
        const existingMatchMap = new Map(
          existingMatches.map((m) => [matchKey(m.homeTeamId, m.awayTeamId, m.matchDate), m]),
        );

        const matchesToInsert: (typeof WcMatchesTable.$inferInsert)[] = [];
        const matchesToUpdate: { id: number; groupId: number }[] = [];

        // 11. Calcular diffs en memoria — cero queries en el loop
        for (const match of matchesRes.matches) {
          const homeTeamId = teamMap.get(match.homeTeam.tla);
          const awayTeamId = teamMap.get(match.awayTeam.tla);
          if (!homeTeamId || !awayTeamId) continue;

          const groupName = normalizeGroup(match.group);
          const groupId = groupName ? (groupMap.get(groupName) ?? null) : null;
          const key = matchKey(homeTeamId, awayTeamId, match.utcDate);
          const existing = existingMatchMap.get(key);

          if (!existing) {
            matchesToInsert.push({
              groupId,
              homeTeamId,
              awayTeamId,
              matchDate: match.utcDate,
              stage: mapStage(match.stage || match.group ? "GROUP_STAGE" : ""),
              status: mapStatus(match.status),
              homeScore: match.score.fullTime.home,
              awayScore: match.score.fullTime.away,
            });
          } else if (existing.groupId === null && groupId !== null) {
            matchesToUpdate.push({ id: existing.id, groupId });
          }
        }

        // 12. Batch insert + batch updates en paralelo
        await Promise.all([
          matchesToInsert.length > 0
            ? client.insert(WcMatchesTable).values(matchesToInsert).run()
            : Promise.resolve(),
          ...matchesToUpdate.map(({ id, groupId }) =>
            client
              .update(WcMatchesTable)
              .set({ groupId, updatedAt: sql`(current_timestamp)` })
              .where(eq(WcMatchesTable.id, id))
              .run(),
          ),
        ]);

        return { success: true };
      },
    }),

    updateMatchScore: defineAction({
      input: z.object({
        matchId: z.number(),
        homeScore: z.number().int().min(0),
        awayScore: z.number().int().min(0),
      }),
      handler: async ({ matchId, homeScore, awayScore }, { request, locals }) => {
        await requireAdmin(locals);

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
      handler: async ({ matchId }, { request, locals }) => {
        await requireAdmin(locals);
        await recalculateMatchPoints(matchId);
        return { success: true };
      },
    }),

    resetMatchScore: defineAction({
      input: z.object({
        matchId: z.number(),
      }),
      handler: async ({ matchId }, { request, locals }) => {
        await requireAdmin(locals);

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
      handler: async (_, { request, locals }) => {
        await requireAdmin(locals);
        return await syncScoresFromApi();
      },
    }),

    checkMatches: defineAction({
      handler: async (_, { request, locals }) => {
        await requireAdmin(locals);

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

async function requireAdmin(locals: App.Locals) {
  const { user } = locals;
  if (!user?.id || !user.is_admin) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "No tienes permisos de administrador",
    });
  }

  return user;
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

  const userIds = [...new Set(predictions.map((p) => p.userId))];
  const users = userIds.length > 0
    ? await client.select().from(UsersTable).where(inArray(UsersTable.id, userIds)).all()
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

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

    const wasAlreadyScored = pred.points !== null;

    if (!wasAlreadyScored && points === 5) {
      await rewardExactScore(pred.userId);
    }

    // Streak logic — only update on first scoring
    const user = userMap.get(pred.userId);
    if (!wasAlreadyScored && user) {
      const prevStreak = user.streak;
      const newStreak = points > 0 ? prevStreak + 1 : 0;
      const newBestStreak = Math.max(user.bestStreak, newStreak);

      await client
        .update(UsersTable)
        .set({
          streak: newStreak,
          bestStreak: newBestStreak,
          lastPredictionAt: sql`(current_timestamp)`,
        })
        .where(eq(UsersTable.id, pred.userId))
        .run();

      // Milestone bonus on streak increments
      if (newStreak > prevStreak) {
        const bonus = getStreakMilestoneBonus(newStreak);
        if (bonus > 0) {
          await client
            .update(UsersTable)
            .set({ coins: sql`coins + ${bonus}` })
            .where(eq(UsersTable.id, pred.userId))
            .run();
        }
      }
    }
  }
}
