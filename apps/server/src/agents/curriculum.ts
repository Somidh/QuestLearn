import { randomBytes } from 'node:crypto';
import { CurriculumPlan, type Llm, type QuestDocument } from '@questlearn/core';
import {
  formatHandoff,
  MAX_HOPS,
  parseHandoff,
  stripHandoff,
  stripMentions,
  SwitchAgent,
  type AgentOptions,
  type RoomMessage,
} from '@questlearn/switch-client';
import { systemPrompt } from '../prompts';
import { TEAM_NAMES } from '../team';

const NAME = 'curriculum-agent';
const MIN_GOAL_LENGTH = 3;

type Connection = Omit<AgentOptions, 'name' | 'onMessage'>;

export function createCurriculumAgent(connection: Connection, llm: Llm): SwitchAgent {
  const system = systemPrompt(NAME, './curriculum.md');

  const agent = new SwitchAgent({ ...connection, name: NAME, onMessage });

  async function onMessage(message: RoomMessage): Promise<void> {
    if (!message.addressed || message.senderName === NAME) return;

    const handoff = parseHandoff(message.body);
    const text = stripMentions(stripHandoff(message.body));

    if (handoff?.type === 'quest.requested' && handoff.quest && handoff.hop < MAX_HOPS) {
      await planRoad(handoff.quest, text.replace(/^.*?Goal:\s*/s, ''), handoff.hop + 1);
    } else if (!handoff && !TEAM_NAMES.has(message.senderName)) {
      // A person started a quest from team chat.
      if (text.length < MIN_GOAL_LENGTH) {
        await agent.post('Tell me what you want to learn, like "@curriculum-agent system design".');
        return;
      }
      await planRoad(`q_${randomBytes(4).toString('hex')}`, text, 1);
    }
  }

  async function planRoad(questId: string, goal: string, hop: number): Promise<void> {
    await agent.post(`Planning a road for "${goal}".`);

    try {
      const plan = await llm.generateJson({
        system,
        prompt: `The learner's goal: ${goal}`,
        schema: CurriculumPlan,
      });

      const document: QuestDocument = {
        questId,
        goal,
        revision: 1,
        checkpoints: plan.checkpoints,
      };
      const { document_id: documentId } = await agent.op<{ document_id: string }>(
        'create_room_document',
        {
          name: `quest-${questId}`,
          description: `The road for "${goal}".`,
          instructions: 'JSON. curriculum-agent owns this document. Read the latest revision.',
          content: JSON.stringify(document),
        },
      );

      const count = plan.checkpoints.length;
      await agent.send(
        formatHandoff(`Road planned: ${count} checkpoints for "${goal}". ${plan.summary}`, {
          type: 'quest.planned',
          quest: questId,
          doc: documentId,
          rev: 1,
          hop,
        }),
        ['game-master', 'resource-scout'],
      );
    } catch (error) {
      connection.log?.(`[${NAME}] planning failed: ${(error as Error).message}`);
      await agent.send(
        formatHandoff(`I could not plan a road for "${goal}".`, {
          type: 'quest.failed',
          quest: questId,
          hop,
        }),
        ['game-master'],
      );
    }
  }

  return agent;
}
