import { eq, sql } from "drizzle-orm";
import { client } from "../../db";
import { UsersTable } from "../../db/schema";

export async function rewardPrediction(userId: number): Promise<void> {
  await client
    .update(UsersTable)
    .set({ coins: sql`coins + 1` })
    .where(eq(UsersTable.id, userId))
    .run();
}

export async function rewardExactScore(userId: number): Promise<void> {
  await client
    .update(UsersTable)
    .set({ coins: sql`coins + 5` })
    .where(eq(UsersTable.id, userId))
    .run();
}

export function getStreakMilestoneBonus(streak: number): number {
  if (streak === 3) return 3;
  if (streak === 5) return 10;
  if (streak === 10) return 25;
  if (streak === 15) return 50;
  if (streak >= 20 && streak % 5 === 0) return 25;
  return 0;
}

export function getLeaderboardPrizes(position: number): number {
  if (position === 1) return 5000;
  if (position === 2) return 3000;
  if (position === 3) return 1000;
  return 0;
}

export async function rewardLeaderboard(
  userId: number,
  position: number,
): Promise<void> {
  const coins = getLeaderboardPrizes(position);
  if (coins <= 0) return;

  await client
    .update(UsersTable)
    .set({ coins: sql`coins + ${coins}` })
    .where(eq(UsersTable.id, userId))
    .run();
}
