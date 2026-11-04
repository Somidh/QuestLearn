import {
  QuestDocument,
  ResourcePick,
  type FoundResource,
  type Llm,
  type ResourceDocument,
} from '@questlearn/core';
import {
  formatHandoff,
  MAX_HOPS,
  parseHandoff,
  SwitchAgent,
  type AgentOptions,
  type Handoff,
  type RoomMessage,
} from '@questlearn/switch-client';
import { systemPrompt } from '../prompts';
import { search, type SearchResult } from '../search/tavily';
import { verifyDoc, verifyVideo } from '../search/verify';

const NAME = 'resource-scout';
const PARALLEL_CHECKPOINTS = 4;
const YOUTUBE = ['youtube.com', 'youtu.be'];

type Connection = Omit<AgentOptions, 'name' | 'onMessage'>;
type Checkpoint = QuestDocument['checkpoints'][number];

async function verified(
  results: SearchResult[],
  check: (result: SearchResult) => Promise<FoundResource | null>,
): Promise<FoundResource[]> {
  const checked = await Promise.all(results.map(check));
  return checked.filter((resource) => resource !== null);
}

async function runInPool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
  };
  await Promise.all(Array.from({ length: size }, worker));
}

export function createResourceScout(
  connection: Connection,
  llm: Llm,
  tavilyApiKey: string,
): SwitchAgent {
  const system = systemPrompt(NAME, './scout.md');
  const agent = new SwitchAgent({ ...connection, name: NAME, onMessage });

  /** Verified candidates, retrying once with a broader query if none survive. */
  async function findCandidates(checkpoint: Checkpoint, goal: string) {
    const lookUp = async (topic: string) => {
      const [docs, videos] = await Promise.all([
        search(tavilyApiKey, `${topic} explained`, { excludeDomains: YOUTUBE }),
        search(tavilyApiKey, `${topic} tutorial`, { includeDomains: ['youtube.com'] }),
      ]);
      return {
        docs: await verified(docs, verifyDoc),
        videos: await verified(videos, verifyVideo),
      };
    };

    const found = await lookUp(`${checkpoint.title} ${goal}`);
    if (found.docs.length > 0 && found.videos.length > 0) return found;

    const broader = await lookUp(checkpoint.title);
    return {
      docs: found.docs.length > 0 ? found.docs : broader.docs,
      videos: found.videos.length > 0 ? found.videos : broader.videos,
    };
  }

  /** The model only returns numbers. Code turns them back into verified links. */
  async function choose(checkpoint: Checkpoint, candidates: FoundResource[]) {
    if (candidates.length === 0) return [];

    const list = candidates
      .map((item, index) => `${index + 1}. [${item.kind}] ${item.title} (${item.source})`)
      .join('\n');
    const pick = await llm.generateJson({
      system,
      prompt: `Checkpoint: ${checkpoint.title}\nWhat it teaches: ${checkpoint.summary}\nDifficulty: ${checkpoint.difficulty} of 5\n\nCandidates:\n${list}`,
      schema: ResourcePick,
    });

    const chosen = [pick.video, ...pick.docs].flatMap((number) => {
      const candidate = number === null ? undefined : candidates[number - 1];
      return candidate ? [candidate] : [];
    });
    return [...new Map(chosen.map((item) => [item.url, item])).values()];
  }

  async function scoutQuest(handoff: Handoff): Promise<void> {
    const documents = await agent.op<{ content: string }[]>('load_internal_documents', {
      ids: [handoff.doc],
    });
    const quest = QuestDocument.parse(JSON.parse(documents[0]?.content ?? 'null'));

    await agent.post(`Scouting real resources for ${quest.checkpoints.length} checkpoints.`);

    const shared: ResourceDocument = { questId: quest.questId, checkpoints: {} };
    const { document_id: documentId } = await agent.op<{ document_id: string }>(
      'create_room_document',
      {
        name: `resources-${quest.questId}`,
        description: `Verified resources for "${quest.goal}", by checkpoint slot.`,
        instructions: 'JSON. resource-scout owns this document.',
        content: JSON.stringify(shared),
      },
    );

    // Only one update can run at a time, or a slower one would overwrite a newer one.
    let reports: Promise<unknown> = Promise.resolve();

    function report(slot: number, title: string, found: FoundResource[]) {
      reports = reports.then(async () => {
        shared.checkpoints[slot] = found;
        await agent.op('update_room_document', {
          document_id: documentId,
          content: JSON.stringify(shared),
        });
        const videos = found.filter((item) => item.kind === 'video').length;
        const text =
          found.length > 0
            ? `${title}: verified ${videos} video and ${found.length - videos} docs.`
            : `${title}: no resource passed verification.`;
        await agent.send(
          formatHandoff(text, {
            type: 'resources.ready',
            quest: quest.questId,
            doc: documentId,
            slot,
            hop: handoff.hop + 1,
          }),
          ['game-master'],
        );
      });
      return reports;
    }

    const slots = quest.checkpoints.map((checkpoint, slot) => ({ checkpoint, slot }));
    await runInPool(slots, PARALLEL_CHECKPOINTS, async ({ checkpoint, slot }) => {
      let found: FoundResource[] = [];
      try {
        const { docs, videos } = await findCandidates(checkpoint, quest.goal);
        found = await choose(checkpoint, [...videos, ...docs]);
      } catch (error) {
        connection.log?.(`[${NAME}] ${checkpoint.title}: ${(error as Error).message}`);
      }
      await report(slot, checkpoint.title, found);
    });
  }

  async function onMessage(message: RoomMessage): Promise<void> {
    if (!message.addressed || message.senderName === NAME) return;

    const handoff = parseHandoff(message.body);
    if (handoff?.type === 'quest.planned' && handoff.doc && handoff.hop < MAX_HOPS) {
      await scoutQuest(handoff);
    }
  }

  return agent;
}
