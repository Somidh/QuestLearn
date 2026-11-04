import type { AppState, QuestView, ServerEvent } from '@questlearn/core';
import { create } from 'zustand';

const FEED_LIMIT = 50;

type GameStore = AppState & {
  loaded: boolean;
  composing: boolean;
  submitting: boolean;
  error: string | null;
  openNodeId: string | null;
  openNode(nodeId: string): void;
  closeNode(): void;
  connect(): () => void;
  submitGoal(goal: string): Promise<void>;
  compose(): void;
};

export const useGame = create<GameStore>((set, get) => ({
  switchConnected: false,
  quest: null,
  activity: [],
  loaded: false,
  composing: false,
  submitting: false,
  error: null,
  openNodeId: null,

  openNode: (nodeId) => set({ openNodeId: nodeId }),
  closeNode: () => set({ openNodeId: null }),

  connect() {
    const source = new EventSource('/api/events');

    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as ServerEvent;
      if (event.type === 'switch') set({ switchConnected: event.connected });
      if (event.type === 'quest') set({ quest: event.quest, composing: false });
      if (event.type === 'activity') {
        const known = get().activity.some((item) => item.id === event.item.id);
        if (!known) set({ activity: [...get().activity, event.item].slice(-FEED_LIMIT) });
      }
    };

    void fetch('/api/state')
      .then((response) => response.json() as Promise<AppState>)
      .then((state) => set({ ...state, loaded: true }))
      .catch(() => set({ loaded: true, error: 'The QuestLearn server is not running.' }));

    return () => source.close();
  },

  async submitGoal(goal) {
    set({ submitting: true, error: null });
    const response = await fetch('/api/quests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
    }).catch(() => null);

    if (!response) {
      set({ submitting: false, error: 'The QuestLearn server is not running.' });
      return;
    }

    const body = (await response.json()) as QuestView & { error?: string };
    if (!response.ok) {
      set({ submitting: false, error: body.error ?? 'That quest could not start.' });
      return;
    }
    set({ submitting: false, composing: false, quest: body });
  },

  compose() {
    set({ composing: true, error: null, openNodeId: null });
  },
}));
