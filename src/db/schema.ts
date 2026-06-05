import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const UsersTable = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  susId: integer('sus_id').unique().notNull(),
  email: text('email'),
  displayName: text('display_name').notNull(),
  username: text('username').notNull(),
  avatar: text('avatar'),
  coins: integer('coins').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  lastPredictionAt: text('last_prediction_at'),
  admin: integer('admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
});

export const WcGroupsTable = sqliteTable('wc_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name', { length: 1 }).unique().notNull(),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
});

export const WcTeamsTable = sqliteTable('wc_teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => WcGroupsTable.id),
  name: text('name').notNull(),
  flag: text('flag'),
  fifaCode: text('fifa_code', { length: 3 }),
});

export const WcMatchesTable = sqliteTable('wc_matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').references(() => WcGroupsTable.id),
  homeTeamId: integer('home_team_id').notNull().references(() => WcTeamsTable.id),
  awayTeamId: integer('away_team_id').notNull().references(() => WcTeamsTable.id),
  matchDate: text('match_date').notNull(),
  stage: text('stage').notNull(),
  status: text('status').notNull().default('scheduled'),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
});

export const WcPredictionsTable = sqliteTable('wc_predictions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => UsersTable.id, { onDelete: 'cascade' }),
  matchId: integer('match_id').notNull().references(() => WcMatchesTable.id, { onDelete: 'cascade' }),
  homeScore: integer('home_score').notNull(),
  awayScore: integer('away_score').notNull(),
  points: integer('points'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
  updatedAt: text('updated_at').notNull().default(sql`(current_timestamp)`),
}, (t) => ({
  userMatchUniq: uniqueIndex('user_match_uniq').on(t.userId, t.matchId),
}));

export const WcGroupsRelations = relations(WcGroupsTable, ({ many }) => ({
  teams: many(WcTeamsTable),
  matches: many(WcMatchesTable),
}));

export const WcTeamsRelations = relations(WcTeamsTable, ({ one, many }) => ({
  group: one(WcGroupsTable, { fields: [WcTeamsTable.groupId], references: [WcGroupsTable.id] }),
  homeMatches: many(WcMatchesTable, { relationName: "homeTeam" }),
  awayMatches: many(WcMatchesTable, { relationName: "awayTeam" }),
}));

export const WcMatchesRelations = relations(WcMatchesTable, ({ one }) => ({
  group: one(WcGroupsTable, { fields: [WcMatchesTable.groupId], references: [WcGroupsTable.id] }),
  homeTeam: one(WcTeamsTable, { fields: [WcMatchesTable.homeTeamId], references: [WcTeamsTable.id], relationName: "homeTeam" }),
  awayTeam: one(WcTeamsTable, { fields: [WcMatchesTable.awayTeamId], references: [WcTeamsTable.id], relationName: "awayTeam" }),
}));
