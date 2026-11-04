import type { FoundResource, Icon } from './schemas';

export type NodeStatus = 'building' | 'locked' | 'current' | 'completed' | 'skipped';
export type QuestStatus = 'building' | 'active' | 'complete' | 'failed';

export type NodeView = {
  id: string;
  slot: number;
  title: string;
  summary: string;
  icon: Icon;
  difficulty: number;
  status: NodeStatus;
  origin: 'curriculum' | 'coach';
  resources: FoundResource[];
};

export type QuestView = {
  id: string;
  goal: string;
  status: QuestStatus;
  failureReason: string | null;
  revision: number;
  nodes: NodeView[];
};

export type ActivityView = {
  id: string;
  senderName: string;
  body: string;
  timestamp: number;
};

export type AppState = {
  switchConnected: boolean;
  quest: QuestView | null;
  activity: ActivityView[];
};

export type ServerEvent =
  | { type: 'switch'; connected: boolean }
  | { type: 'quest'; quest: QuestView }
  | { type: 'activity'; item: ActivityView };
