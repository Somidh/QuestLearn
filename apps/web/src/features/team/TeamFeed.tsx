import { useEffect, useRef } from 'react';
import { useGame } from '../../store/game';

const VISIBLE_MESSAGES = 12;

export function TeamFeed() {
  const activity = useGame((state) => state.activity);
  const list = useRef<HTMLOListElement>(null);
  const recent = activity.slice(-VISIBLE_MESSAGES);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [activity.length]);

  return (
    <aside
      aria-label="Live messages from the team room"
      className="absolute top-20 right-6 w-[340px] rounded-2xl border border-mist/15 bg-dusk/80 px-4 py-3 backdrop-blur"
    >
      <h2 className="flex items-center gap-2 font-display text-lg text-paper">
        <span className="size-2.5 rounded-full bg-mint" />
        #quest-build
      </h2>
      <ol ref={list} aria-live="polite" className="mt-2 max-h-[25vh] space-y-2 overflow-y-auto">
        {recent.map((item) => (
          <li key={item.id} className="text-sm leading-snug">
            <span className="font-semibold text-glow">{item.senderName}</span>
            <p className="line-clamp-3 text-mist">{item.body}</p>
          </li>
        ))}
        {recent.length === 0 && <li className="text-sm text-mist">No messages yet.</li>}
      </ol>
    </aside>
  );
}
