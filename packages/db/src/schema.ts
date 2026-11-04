import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const quests = sqliteTable('quests', {
  id: text('id').primaryKey(),
  goal: text('goal').notNull(),
  status: text('status').notNull(),
  failureReason: text('failure_reason'),
  revision: integer('revision').notNull().default(0),
  switchDocId: text('switch_doc_id'),
  createdAt: integer('created_at').notNull(),
});

export const nodes = sqliteTable('nodes', {
  id: text('id').primaryKey(),
  questId: text('quest_id').notNull(),
  slot: integer('slot').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  icon: text('icon').notNull(),
  difficulty: integer('difficulty').notNull(),
  status: text('status').notNull(),
  origin: text('origin').notNull(),
  insertedFor: text('inserted_for'),
});

export const resources = sqliteTable('resources', {
  id: text('id').primaryKey(),
  nodeId: text('node_id').notNull(),
  kind: text('kind').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  source: text('source').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  verifiedAt: integer('verified_at').notNull(),
});

export const activity = sqliteTable('activity', {
  id: text('id').primaryKey(),
  sender: text('sender').notNull(),
  senderName: text('sender_name').notNull(),
  body: text('body').notNull(),
  timestamp: real('timestamp').notNull(),
});
