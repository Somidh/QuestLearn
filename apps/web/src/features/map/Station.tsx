import type { Icon, NodeView } from '@questlearn/core';
import {
  BarChart3,
  BookOpen,
  Cog,
  Code2,
  Compass,
  Database,
  Flag,
  FlaskConical,
  Globe,
  Layers,
  Lock,
  Network,
  Puzzle,
  Server,
  Shield,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { roadSlot, SLOT_POINTS } from './roadGeometry';

const ICONS: Record<Icon, LucideIcon> = {
  compass: Compass,
  book: BookOpen,
  gear: Cog,
  server: Server,
  database: Database,
  network: Network,
  bolt: Zap,
  shield: Shield,
  layers: Layers,
  code: Code2,
  chart: BarChart3,
  puzzle: Puzzle,
  flask: FlaskConical,
  globe: Globe,
  lock: Lock,
  flag: Flag,
};

const STATE_STYLES: Record<NodeView['status'], { fill: string; ink: string; text: string }> = {
  current: { fill: '#ffb72b', ink: '#1b1340', text: '#f6efdc' },
  completed: { fill: '#2ee6a6', ink: '#1b1340', text: '#f6efdc' },
  locked: { fill: '#2e1f5e', ink: '#c9c0ee', text: '#c9c0ee' },
  building: { fill: '#1b1340', ink: '#7fd4ff', text: '#7fd4ff' },
  skipped: { fill: '#2e1f5e', ink: '#6f62a8', text: '#6f62a8' },
};

const ROAD_EDGE = 30;
const LANTERN_RADIUS = 34;
const POST_HEIGHT = 108;
const CHARS_PER_LINE = 20;

function wrapTitle(title: string): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of title.split(' ')) {
    if (line && `${line} ${word}`.length > CHARS_PER_LINE) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  return [...lines, line];
}

type StationProps = {
  node: NodeView;
  index: number;
  onOpen: (nodeId: string) => void;
  onFocus: (x: number) => void;
};

const STATUS_LABELS: Record<NodeView['status'], string> = {
  current: 'next stop',
  completed: 'completed',
  locked: 'locked',
  building: 'under construction',
  skipped: 'skipped',
};

export function Station({ node, index, onOpen, onFocus }: StationProps) {
  const point = SLOT_POINTS[roadSlot(node.slot)]!;
  const style = STATE_STYLES[node.status];
  const Glyph = ICONS[node.icon];
  const lines = wrapTitle(node.title);
  const lanternY = -POST_HEIGHT;
  const canOpen = node.status === 'current' || node.status === 'completed';
  const building = node.status === 'building';

  return (
    <g
      transform={`translate(${point.x} ${point.y - ROAD_EDGE})`}
      role={canOpen ? 'button' : 'img'}
      tabIndex={0}
      aria-label={`${node.title}, ${STATUS_LABELS[node.status]}`}
      className={canOpen ? 'cursor-pointer' : undefined}
      onClick={canOpen ? () => onOpen(node.id) : undefined}
      onFocus={() => onFocus(point.x)}
      onKeyDown={(event) => {
        if (canOpen && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen(node.id);
        }
      }}
    >
      <motion.g
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.15 + index * 0.13 }}
      >
        <line y1="0" y2={lanternY} stroke="#c9c0ee" strokeWidth="5" strokeLinecap="round" />

        {node.status === 'current' && (
          <motion.circle
            cy={lanternY}
            r={LANTERN_RADIUS}
            fill="none"
            stroke="#ffb72b"
            strokeWidth="3"
            animate={{ scale: [1, 1.7], opacity: [0.8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}

        <circle
          cy={lanternY}
          r={LANTERN_RADIUS}
          fill={style.fill}
          stroke={building ? '#7fd4ff' : node.status === 'locked' ? '#6f62a8' : style.fill}
          strokeWidth="3"
          strokeDasharray={building ? '9 8' : undefined}
        />
        <Glyph x={-17} y={lanternY - 17} width={34} height={34} color={style.ink} strokeWidth={2} />

        <text
          textAnchor="middle"
          y={lanternY - LANTERN_RADIUS - 16 - (lines.length - 1) * 25}
          fill={style.text}
          fontFamily="Fredoka Variable, sans-serif"
          fontSize="22"
          fontWeight="500"
          stroke="#1b1340"
          strokeWidth="6"
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {lines.map((line, row) => (
            <tspan key={line} x="0" dy={row === 0 ? 0 : 25}>
              {line}
            </tspan>
          ))}
        </text>
      </motion.g>
    </g>
  );
}
