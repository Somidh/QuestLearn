import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentCredentials, AgentDefinition } from '@questlearn/switch-client';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const ROOM_NAME = 'quest-build';

export const ROOM_DESCRIPTION = 'The QuestLearn tutor team builds your learning road here.';

export const ROOM_INSTRUCTIONS = [
  'This is the QuestLearn tutor team room.',
  'Hand work to a teammate by addressing them with @name.',
  'Every handoff ends with a [questlearn v1 ...] line, which code reads.',
  'To start a quest in chat, write: @curriculum-agent <what you want to learn>.',
].join(' ');

export const TEAM: AgentDefinition[] = [
  {
    name: 'curriculum-agent',
    displayName: 'Curriculum Agent',
    description: 'Turns a learning goal into an ordered road of checkpoints.',
  },
  {
    name: 'resource-scout',
    displayName: 'Resource Scout',
    description: 'Finds real, verified videos and docs for each checkpoint.',
  },
  {
    name: 'quiz-master',
    displayName: 'Quiz Master',
    description: 'Writes the quiz that guards each checkpoint.',
  },
  {
    name: 'coach',
    displayName: 'Coach',
    description: 'Watches how you are doing and decides how to adapt the road.',
  },
  {
    name: 'game-master',
    displayName: 'Game Master',
    description: 'Runs the game rules: XP, unlocks and triggers. Uses no LLM.',
  },
];

export const TEAM_NAMES = new Set(TEAM.map((agent) => agent.name));

export type StoredAgent = AgentCredentials & { connectionId: string };

export type TeamStore = {
  roomId?: string;
  agents: Record<string, StoredAgent>;
};

const storePath = join(repoRoot, '.agents.local.json');

export function readTeamStore(): TeamStore {
  if (!existsSync(storePath)) return { agents: {} };
  return JSON.parse(readFileSync(storePath, 'utf8')) as TeamStore;
}

export function writeTeamStore(store: TeamStore): void {
  writeFileSync(storePath, JSON.stringify(store, null, 2), { mode: 0o600 });
}
