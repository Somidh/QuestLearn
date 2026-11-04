import { randomBytes } from 'node:crypto';
import {
  QuestDocument,
  ResourceDocument,
  type QuestView,
  type ServerEvent,
} from '@questlearn/core';
import type { Db, NewNode } from '@questlearn/db';
import {
  formatHandoff,
  parseHandoff,
  stripHandoff,
  SwitchAgent,
  type AgentOptions,
  type Handoff,
  type RoomMessage,
} from '@questlearn/switch-client';

const NAME = 'game-master';
const BUILD_TIMEOUT_MS = 120_000;
// Switch announces document changes in the room. The feed doesn't need them.
const DOCUMENT_NOTICE = /^(📄|🗑)/u;

type Connection = Omit<AgentOptions, 'name' | 'onMessage' | 'filter'>;

export type GameMaster = {
  agent: SwitchAgent;
  startQuest(goal: string): Promise<QuestView>;
};

/**
 * Runs the game by fixed rules, with no LLM. It is the app's voice in the room,
 * reads every message so the browser can mirror it, and is the only agent that
 * writes to the database.
 */
export function createGameMaster(
  connection: Connection,
  db: Db,
  emit: (event: ServerEvent) => void,
): GameMaster {
  const agent = new SwitchAgent({ ...connection, name: NAME, filter: 'all', onMessage });

  function publishQuest(questId: string): void {
    const quest = db.readQuest(questId);
    if (quest) emit({ type: 'quest', quest });
  }

  function mirror(message: RoomMessage): void {
    const body = stripHandoff(message.body);
    if (!body || DOCUMENT_NOTICE.test(body)) return;
    const item = {
      id: message.messageId,
      sender: message.sender,
      senderName: message.senderName,
      body,
      timestamp: message.timestamp,
    };
    db.addActivity(item);
    emit({ type: 'activity', item });
  }

  async function readDocument(id: string): Promise<unknown> {
    const documents = await agent.op<{ content: string }[]>('load_internal_documents', {
      ids: [id],
    });
    const content = documents[0]?.content;
    if (!content) throw new Error(`Room document ${id} is empty.`);
    return JSON.parse(content);
  }

  async function onPlanned(handoff: Handoff): Promise<void> {
    if (!handoff.quest || !handoff.doc || handoff.rev === undefined) return;

    const document = QuestDocument.parse(await readDocument(handoff.doc));

    // A quest started in chat reaches this agent for the first time here.
    db.createQuest(document.questId, document.goal);

    // Stations stay under construction until the team has filled them.
    const road: NewNode[] = document.checkpoints.map((checkpoint) => ({
      ...checkpoint,
      status: 'building',
    }));
    db.saveRoad(document.questId, handoff.doc, handoff.rev, road);
    publishQuest(document.questId);
  }

  async function onResources(handoff: Handoff): Promise<void> {
    const slot = Number(handoff.slot);
    if (!handoff.quest || !handoff.doc || !Number.isInteger(slot)) return;

    const document = ResourceDocument.parse(await readDocument(handoff.doc));
    db.saveResources(handoff.quest, slot, document.checkpoints[slot] ?? []);
    publishQuest(handoff.quest);
  }

  async function onMessage(message: RoomMessage): Promise<void> {
    mirror(message);
    if (!message.addressed || message.senderName === NAME) return;

    const handoff = parseHandoff(message.body);
    if (handoff?.type === 'quest.planned') {
      await onPlanned(handoff);
    } else if (handoff?.type === 'resources.ready') {
      await onResources(handoff);
    } else if (handoff?.type === 'quest.failed' && handoff.quest) {
      db.failQuest(handoff.quest, 'The team could not plan this road. Try again.');
      publishQuest(handoff.quest);
    }
  }

  async function startQuest(goal: string): Promise<QuestView> {
    const questId = `q_${randomBytes(4).toString('hex')}`;
    db.createQuest(questId, goal);

    await agent.send(
      formatHandoff(`New quest. Goal: ${goal}`, {
        type: 'quest.requested',
        quest: questId,
        hop: 1,
      }),
      ['curriculum-agent'],
    );

    setTimeout(() => {
      if (db.readQuest(questId)?.status !== 'building') return;
      db.failQuest(questId, 'The tutor team did not answer in time. Check that Switch is running.');
      publishQuest(questId);
    }, BUILD_TIMEOUT_MS);

    return db.readQuest(questId)!;
  }

  return { agent, startQuest };
}
