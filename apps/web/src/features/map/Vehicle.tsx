import { useMotionValueEvent, type MotionValue } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';
import { pointAt } from './roadGeometry';

export function Vehicle({ length }: { length: MotionValue<number> }) {
  const ref = useRef<SVGGElement>(null);

  function place(distance: number) {
    const { x, y, angle } = pointAt(distance);
    ref.current?.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
  }

  useLayoutEffect(() => place(length.get()));
  useMotionValueEvent(length, 'change', place);

  return (
    <g ref={ref}>
      <defs>
        <linearGradient id="beam" x1="0" x2="1">
          <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.65" />
          <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d="M 62 -20 L 300 -52 L 300 26 Z" fill="url(#beam)" />

      <ellipse cx="0" cy="14" rx="74" ry="9" fill="#120b2c" opacity="0.5" />

      {/* Body, drawn around the rear axle's midpoint, facing right. */}
      <rect x="-40" y="-78" width="62" height="10" rx="3" fill="#2ee6a6" />
      <path
        d="M -70 -8 L -70 -56 Q -70 -68 -58 -68 L 26 -68 Q 38 -68 44 -58 L 58 -34 Q 70 -32 70 -20 L 70 -8 Z"
        fill="#f6efdc"
      />
      <path d="M -70 -30 L 70 -30 L 70 -18 L -70 -18 Z" fill="#ff5c7a" />
      <path d="M 14 -60 L 28 -60 Q 34 -60 37 -55 L 47 -38 L 14 -38 Z" fill="#7fd4ff" />
      <rect x="-56" y="-60" width="26" height="22" rx="4" fill="#ffb72b" />
      <rect x="-22" y="-60" width="26" height="22" rx="4" fill="#ffb72b" />
      <rect x="62" y="-26" width="9" height="7" rx="2" fill="#ffe9a8" />

      <circle cx="-40" cy="-6" r="15" fill="#1b1340" />
      <circle cx="-40" cy="-6" r="6" fill="#c9c0ee" />
      <circle cx="42" cy="-6" r="15" fill="#1b1340" />
      <circle cx="42" cy="-6" r="6" fill="#c9c0ee" />
    </g>
  );
}
