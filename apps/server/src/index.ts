import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { createLlm } from '@questlearn/core';
import { openDb } from '@questlearn/db';
import { createCurriculumAgent } from './agents/curriculum';
import { createGameMaster } from './agents/game-master';
import { createResourceScout } from './agents/resource-scout';
import { createApp, createBus } from './http/routes';
import { readTeamStore, repoRoot, TEAM } from './team';

const PORT = Number(process.env.PORT ?? 8787);

const apiUrl = process.env.SWITCH_API_URL ?? 'http://localhost:8000';
const store = readTeamStore();
const { roomId } = store;

if (!roomId || TEAM.some((agent) => !store.agents[agent.name])) {
  console.error('The agent team is not set up yet. Run pnpm bootstrap first.');
  process.exit(1);
}

const tavilyApiKey = process.env.TAVILY_API_KEY;
if (!tavilyApiKey) {
  console.error('.env needs TAVILY_API_KEY. Resource Scout searches the web with it.');
  process.exit(1);
}

const llm = createLlm({
  provider: process.env.LLM_PROVIDER ?? 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
});

const db = openDb(join(repoRoot, 'data', 'questlearn.db'));
const bus = createBus();

function connection(name: string) {
  return { apiUrl, roomId: roomId!, log: console.log, ...store.agents[name]! };
}

const gameMaster = createGameMaster(
  {
    ...connection('game-master'),
    onStatus: (connected) => bus.emit({ type: 'switch', connected }),
  },
  db,
  bus.emit,
);
const curriculum = createCurriculumAgent(connection('curriculum-agent'), llm);
const scout = createResourceScout(connection('resource-scout'), llm, tavilyApiKey);

serve({ fetch: createApp(db, gameMaster, bus).fetch, port: PORT }, () => {
  console.log(`QuestLearn server on http://localhost:${PORT}`);
});

await Promise.all([gameMaster.agent.start(), curriculum.start(), scout.start()]);
console.log('Agents connected to #quest-build');
