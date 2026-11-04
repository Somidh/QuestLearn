import { EventEmitter } from 'node:events';
import { GoalInput, type AppState, type ServerEvent } from '@questlearn/core';
import type { Db } from '@questlearn/db';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { GameMaster } from '../agents/game-master';

const KEEPALIVE_MS = 15_000;

export function createBus() {
  const bus = new EventEmitter();
  bus.setMaxListeners(0);
  return {
    emit: (event: ServerEvent) => bus.emit('event', event),
    subscribe(listener: (event: ServerEvent) => void) {
      bus.on('event', listener);
      return () => {
        bus.off('event', listener);
      };
    },
  };
}

type Bus = ReturnType<typeof createBus>;

export function createApp(db: Db, gameMaster: GameMaster, bus: Bus): Hono {
  const app = new Hono();

  app.get('/api/state', (c) => {
    const state: AppState = {
      switchConnected: gameMaster.agent.connected,
      quest: db.latestQuest(),
      activity: db.recentActivity(),
    };
    return c.json(state);
  });

  app.post('/api/quests', async (c) => {
    const input = GoalInput.safeParse(await c.req.json().catch(() => null));
    if (!input.success) {
      return c.json({ error: input.error.issues[0]?.message ?? 'Type a goal.' }, 400);
    }
    if (!gameMaster.agent.connected) {
      return c.json({ error: 'Switch is not connected. Start it with pnpm switch:up.' }, 503);
    }
    return c.json(await gameMaster.startQuest(input.data.goal), 201);
  });

  app.get('/api/events', (c) =>
    streamSSE(c, async (stream) => {
      const unsubscribe = bus.subscribe((event) => {
        void stream.writeSSE({ data: JSON.stringify(event) });
      });
      stream.onAbort(unsubscribe);
      while (!stream.aborted) {
        await stream.sleep(KEEPALIVE_MS);
        await stream.writeSSE({ event: 'keepalive', data: '' });
      }
    }),
  );

  return app;
}
