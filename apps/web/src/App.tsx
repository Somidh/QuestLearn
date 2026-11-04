import { AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
import { GoalSign } from './features/goal/GoalSign';
import { QuestMap } from './features/map/QuestMap';
import { NodeSheet } from './features/node/NodeSheet';
import { TeamFeed } from './features/team/TeamFeed';
import { useGame } from './store/game';

export function App() {
  const { connect, loaded, quest, composing, compose, switchConnected, openNodeId } = useGame();

  useEffect(() => connect(), [connect]);

  const showSign = loaded && (composing || !quest);
  const onRoad = Boolean(quest) && !composing;
  const openNode = quest?.nodes.find((node) => node.id === openNodeId);

  return (
    <main className="relative h-full w-full overflow-hidden">
      <QuestMap quest={onRoad ? quest : null} />

      <header className="absolute top-5 left-6 flex items-center gap-4">
        <span className="font-display text-2xl font-semibold text-paper">QuestLearn</span>
        {onRoad && quest && (
          <>
            <span className="max-w-[40vw] truncate text-mist">{quest.goal}</span>
            <button
              type="button"
              onClick={compose}
              className="rounded-full border border-mist/40 px-3 py-1 text-sm text-mist hover:border-paper hover:text-paper"
            >
              New quest
            </button>
          </>
        )}
      </header>

      {loaded && !switchConnected && (
        <p
          role="status"
          className="absolute top-5 right-6 rounded-lg bg-coral px-3 py-1.5 text-sm font-medium text-dusk"
        >
          Switch is offline. Start it with pnpm switch:up.
        </p>
      )}

      {onRoad && quest?.status === 'failed' && (
        <div
          role="alert"
          className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-plum px-5 py-3"
        >
          <p>{quest.failureReason}</p>
          <button
            type="button"
            onClick={compose}
            className="rounded-lg bg-glow px-3 py-1.5 font-medium text-dusk"
          >
            Try again
          </button>
        </div>
      )}

      {onRoad && <TeamFeed />}

      <AnimatePresence>{showSign && <GoalSign key="sign" />}</AnimatePresence>
      <AnimatePresence>{openNode && <NodeSheet key={openNode.id} node={openNode} />}</AnimatePresence>
    </main>
  );
}
