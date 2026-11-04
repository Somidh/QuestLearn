import type { QuestView } from '@questlearn/core';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, type WheelEvent } from 'react';
import { useGame } from '../../store/game';
import { Road } from './Road';
import {
  pointAt,
  roadSlot,
  SLOT_LENGTHS,
  SLOT_POINTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './roadGeometry';
import { Scenery } from './Scenery';
import { Station } from './Station';
import { useViewWidth } from './useViewWidth';
import { Vehicle } from './Vehicle';

const VAN_SCREEN_POSITION = 0.3;
const ROAD_END_MARGIN = 0.7;

function vanSlot(quest: QuestView | null): number {
  const current = quest?.nodes.find((node) => node.status === 'current');
  // Waits at the trailhead, just before the first station.
  return current && current.slot > 0 ? roadSlot(current.slot) : 0;
}

export function QuestMap({ quest }: { quest: QuestView | null }) {
  const openNode = useGame((state) => state.openNode);
  const viewWidth = useViewWidth();
  const nodes = quest?.nodes ?? [];

  const target = SLOT_LENGTHS[vanSlot(quest)]!;
  const length = useSpring(target, { stiffness: 36, damping: 15 });
  useEffect(() => length.set(target), [length, target]);

  // How far the person has scrolled away from the van.
  const scrolled = useMotionValue(0);
  const scroll = useSpring(scrolled, { stiffness: 220, damping: 32 });
  useEffect(() => scrolled.set(0), [scrolled, target]);

  const lastNode = nodes[nodes.length - 1];
  const lastSlot = lastNode ? roadSlot(lastNode.slot) : 0;
  const plannedLength = lastNode ? SLOT_LENGTHS[lastSlot]! : 0;
  const lastX = SLOT_POINTS[lastSlot]!.x;
  const furthest = Math.max(0, Math.min(lastX - viewWidth * ROAD_END_MARGIN, WORLD_WIDTH - viewWidth));

  const follow = (distance: number) => pointAt(distance).x - viewWidth * VAN_SCREEN_POSITION;
  const clamp = (value: number) => Math.max(0, Math.min(value, Math.max(furthest, follow(length.get()))));

  const camera = useTransform(() => clamp(follow(length.get()) + scroll.get()));
  const worldX = useTransform(camera, (value) => -value);

  function onWheel(event: WheelEvent) {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const base = follow(length.get());
    scrolled.set(clamp(base + scrolled.get() + delta) - base);
  }

  /** Brings a station into view, for keyboard users tabbing along the road. */
  function reveal(x: number) {
    scrolled.set(clamp(x - viewWidth / 2) - follow(length.get()));
  }

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${viewWidth} ${WORLD_HEIGHT}`}
      preserveAspectRatio="xMinYMid slice"
      aria-label={quest ? `Road map for ${quest.goal}` : 'A van waiting on an empty road at dusk'}
      onWheel={onWheel}
    >
      <Scenery camera={camera} />
      <motion.g style={{ x: worldX }}>
        <Road plannedLength={plannedLength} drivenLength={length} />
        {nodes.map((node, index) => (
          <Station key={node.id} node={node} index={index} onOpen={openNode} onFocus={reveal} />
        ))}
        <Vehicle length={length} />
      </motion.g>
    </svg>
  );
}
