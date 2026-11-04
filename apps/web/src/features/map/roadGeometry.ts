// One fixed road. Stations sit at slots along it, so a rebuild moves stations
// and never has to morph the path.

export const SLOT_COUNT = 16;
export const WORLD_HEIGHT = 900;

const SLOT_GAP = 400;
const FIRST_SLOT_X = 300;
const LEAD_OUT = 700;

export const WORLD_WIDTH = FIRST_SLOT_X + (SLOT_COUNT - 1) * SLOT_GAP + LEAD_OUT;

export type Point = { x: number; y: number };

function roadY(index: number): number {
  return 668 + 62 * Math.sin(index * 1.15 + 0.4) + 26 * Math.sin(index * 0.5);
}

/** Slot 0 is the trailhead where the van starts. Stations begin at slot 1. */
export const SLOT_POINTS: Point[] = Array.from({ length: SLOT_COUNT }, (_, index) => ({
  x: FIRST_SLOT_X + index * SLOT_GAP,
  y: roadY(index),
}));

const CONTROL_POINTS: Point[] = [
  { x: -300, y: roadY(-1) },
  ...SLOT_POINTS,
  { x: WORLD_WIDTH + 300, y: roadY(SLOT_COUNT) },
];

/** Catmull-Rom through the points, written as cubic Beziers. */
function pathThrough(points: Point[]): string[] {
  const segments: string[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    segments.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`);
  }
  return segments;
}

const SEGMENTS = pathThrough(CONTROL_POINTS);
const START = `M ${CONTROL_POINTS[0]!.x} ${CONTROL_POINTS[0]!.y}`;

export const ROAD_PATH = `${START} ${SEGMENTS.join(' ')}`;

function probe(d: string): SVGPathElement {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  return path;
}

const road = probe(ROAD_PATH);

export const ROAD_LENGTH = road.getTotalLength();

/** Distance along the road to each slot. The first segment leads in to slot 0. */
export const SLOT_LENGTHS: number[] = SLOT_POINTS.map((_, index) =>
  probe(`${START} ${SEGMENTS.slice(0, index + 1).join(' ')}`).getTotalLength(),
);

export function pointAt(length: number): Point & { angle: number } {
  const here = road.getPointAtLength(length);
  const ahead = road.getPointAtLength(length + 2);
  const angle = (Math.atan2(ahead.y - here.y, ahead.x - here.x) * 180) / Math.PI;
  return { x: here.x, y: here.y, angle };
}

/** Node slots count from 0, and road slot 0 is the trailhead. */
export const roadSlot = (nodeSlot: number) => nodeSlot + 1;
