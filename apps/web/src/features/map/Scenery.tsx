import { motion, useTransform, type MotionValue } from 'motion/react';
import { WORLD_HEIGHT, WORLD_WIDTH } from './roadGeometry';

const SCENERY_WIDTH = WORLD_WIDTH + 1200;

// Seeded so the stars stay put between renders.
function random(seed: number): number {
  const value = Math.sin(seed * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

const STARS = Array.from({ length: 150 }, (_, index) => ({
  x: random(index + 1) * 3000,
  y: random(index + 500) * 430,
  r: 0.7 + random(index + 900) * 1.5,
  opacity: 0.25 + random(index + 1300) * 0.6,
}));

function ridge(base: number, height: number, step: number, seed: number): string {
  let d = `M -200 ${WORLD_HEIGHT} L -200 ${base}`;
  for (let x = -200, index = 0; x < SCENERY_WIDTH; x += step, index += 1) {
    const peak = base - random(seed + index) * height;
    d += ` Q ${x + step / 2} ${peak} ${x + step} ${base - random(seed + index + 1) * height * 0.4}`;
  }
  return `${d} L ${SCENERY_WIDTH} ${WORLD_HEIGHT} Z`;
}

const FAR_RIDGE = ridge(470, 170, 340, 11);
const NEAR_RIDGE = ridge(540, 120, 260, 37);
const GROUND = ridge(600, 34, 420, 71);

function Layer({
  camera,
  depth,
  children,
}: {
  camera: MotionValue<number>;
  depth: number;
  children: React.ReactNode;
}) {
  const x = useTransform(camera, (value) => -value * depth);
  return <motion.g style={{ x }}>{children}</motion.g>;
}

export function Scenery({ camera }: { camera: MotionValue<number> }) {
  return (
    <>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140d33" />
          <stop offset="0.27" stopColor="#2e1f5e" />
          <stop offset="0.38" stopColor="#7a3a78" />
          <stop offset="0.47" stopColor="#e8707a" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="100%" height={WORLD_HEIGHT} fill="url(#sky)" />

      <Layer camera={camera} depth={0.04}>
        {STARS.map((star) => (
          <circle
            key={`${star.x}-${star.y}`}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="#f6efdc"
            opacity={star.opacity}
          />
        ))}
        <circle cx="520" cy="130" r="46" fill="#f6efdc" opacity="0.92" />
        <circle cx="542" cy="118" r="40" fill="#1a1140" />
      </Layer>

      <Layer camera={camera} depth={0.18}>
        <path d={FAR_RIDGE} fill="#3a2470" />
      </Layer>
      <Layer camera={camera} depth={0.42}>
        <path d={NEAR_RIDGE} fill="#2a1a5a" />
      </Layer>
      <Layer camera={camera} depth={1}>
        <path d={GROUND} fill="#1b1340" />
      </Layer>
    </>
  );
}
