import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { asc, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type {
  ActivityView,
  FoundResource,
  Icon,
  NodeStatus,
  NodeView,
  QuestStatus,
  QuestView,
} from '@questlearn/core';
import { activity, nodes, quests, resources } from './schema';

// Tables are created here rather than by a migration tool. The database is
// local and disposable: delete data/ after a schema change.
const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY, goal TEXT NOT NULL, status TEXT NOT NULL, failure_reason TEXT,
    revision INTEGER NOT NULL DEFAULT 0, switch_doc_id TEXT, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY, quest_id TEXT NOT NULL, slot INTEGER NOT NULL, title TEXT NOT NULL,
    summary TEXT NOT NULL, icon TEXT NOT NULL, difficulty INTEGER NOT NULL, status TEXT NOT NULL,
    origin TEXT NOT NULL, inserted_for TEXT
  );
  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY, node_id TEXT NOT NULL, kind TEXT NOT NULL, url TEXT NOT NULL,
    title TEXT NOT NULL, source TEXT NOT NULL, thumbnail_url TEXT, verified_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY, sender TEXT NOT NULL, sender_name TEXT NOT NULL, body TEXT NOT NULL,
    timestamp REAL NOT NULL
  );
`;

export type NewNode = Pick<NodeView, 'title' | 'summary' | 'icon' | 'difficulty' | 'status'>;

const nodeId = (questId: string, slot: number) => `${questId}_n${slot}`;

export function openDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(CREATE_TABLES);
  const db = drizzle(sqlite);

  function readQuest(id: string): QuestView | null {
    const quest = db.select().from(quests).where(eq(quests.id, id)).get();
    if (!quest) return null;
    const rows = db
      .select()
      .from(nodes)
      .where(eq(nodes.questId, id))
      .orderBy(asc(nodes.slot))
      .all();
    return {
      id: quest.id,
      goal: quest.goal,
      status: quest.status as QuestStatus,
      failureReason: quest.failureReason,
      revision: quest.revision,
      nodes: rows.map((row) => ({
        id: row.id,
        slot: row.slot,
        title: row.title,
        summary: row.summary,
        icon: row.icon as Icon,
        difficulty: row.difficulty,
        status: row.status as NodeStatus,
        origin: row.origin as NodeView['origin'],
        resources: readResources(row.id),
      })),
    };
  }

  function readResources(id: string): FoundResource[] {
    return db
      .select()
      .from(resources)
      .where(eq(resources.nodeId, id))
      .all()
      .map((row) => ({
        kind: row.kind as FoundResource['kind'],
        url: row.url,
        title: row.title,
        source: row.source,
        thumbnailUrl: row.thumbnailUrl,
      }));
  }

  return {
    createQuest(id: string, goal: string): void {
      db.insert(quests)
        .values({ id, goal, status: 'building', createdAt: Date.now() })
        .onConflictDoNothing()
        .run();
    },

    readQuest,

    latestQuest(): QuestView | null {
      const latest = db.select().from(quests).orderBy(desc(quests.createdAt)).limit(1).get();
      return latest ? readQuest(latest.id) : null;
    },

    /** Writes the first road for a quest. Repeating a delivery changes nothing. */
    saveRoad(questId: string, docId: string, revision: number, road: NewNode[]): void {
      sqlite.transaction(() => {
        const quest = db.select().from(quests).where(eq(quests.id, questId)).get();
        if (!quest || quest.revision >= revision) return;
        db.update(quests)
          .set({ status: 'active', switchDocId: docId, revision })
          .where(eq(quests.id, questId))
          .run();
        db.insert(nodes)
          .values(
            road.map((node, slot) => ({
              ...node,
              id: nodeId(questId, slot),
              questId,
              slot,
              origin: 'curriculum',
            })),
          )
          .run();
      })();
    },

    /** Saves a checkpoint's resources and opens its station. Safe to repeat. */
    saveResources(questId: string, slot: number, found: FoundResource[]): void {
      const id = nodeId(questId, slot);
      sqlite.transaction(() => {
        const node = db.select().from(nodes).where(eq(nodes.id, id)).get();
        if (!node) return;

        db.delete(resources).where(eq(resources.nodeId, id)).run();
        if (found.length > 0) {
          db.insert(resources)
            .values(
              found.map((resource, index) => ({
                ...resource,
                id: `${id}_r${index}`,
                nodeId: id,
                verifiedAt: Date.now(),
              })),
            )
            .run();
        }

        if (node.status === 'building') {
          const status: NodeStatus = slot === 0 ? 'current' : 'locked';
          db.update(nodes).set({ status }).where(eq(nodes.id, id)).run();
        }
      })();
    },

    failQuest(questId: string, reason: string): void {
      db.update(quests)
        .set({ status: 'failed', failureReason: reason })
        .where(eq(quests.id, questId))
        .run();
    },

    addActivity(item: ActivityView & { sender: string }): void {
      db.insert(activity).values(item).onConflictDoNothing().run();
    },

    recentActivity(limit = 50): ActivityView[] {
      return db
        .select({
          id: activity.id,
          senderName: activity.senderName,
          body: activity.body,
          timestamp: activity.timestamp,
        })
        .from(activity)
        .orderBy(desc(activity.timestamp))
        .limit(limit)
        .all()
        .reverse();
    },
  };
}

export type Db = ReturnType<typeof openDb>;
