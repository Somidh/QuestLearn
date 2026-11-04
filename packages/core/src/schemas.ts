import { z } from 'zod';

export const ICONS = [
  'compass',
  'book',
  'gear',
  'server',
  'database',
  'network',
  'bolt',
  'shield',
  'layers',
  'code',
  'chart',
  'puzzle',
  'flask',
  'globe',
  'lock',
  'flag',
] as const;

export type Icon = (typeof ICONS)[number];

export const CheckpointPlan = z.object({
  title: z.string().min(2).max(60),
  summary: z.string().min(5).max(200),
  difficulty: z.number().int().min(1).max(5),
  icon: z.enum(ICONS).catch('compass'),
});

export const CurriculumPlan = z.object({
  summary: z.string().max(600),
  checkpoints: z.array(CheckpointPlan).min(6).max(10),
});

export type CurriculumPlan = z.infer<typeof CurriculumPlan>;

/** The shared quest document that curriculum-agent keeps in the room. */
export const QuestDocument = z.object({
  questId: z.string(),
  goal: z.string(),
  revision: z.number().int(),
  checkpoints: z.array(CheckpointPlan),
});

export type QuestDocument = z.infer<typeof QuestDocument>;

/** What the model returns: candidate numbers only, never a URL. */
export const ResourcePick = z.object({
  video: z.number().int().nullable(),
  docs: z.array(z.number().int()).max(2),
});

export type ResourcePick = z.infer<typeof ResourcePick>;

export const FoundResource = z.object({
  kind: z.enum(['video', 'doc']),
  url: z.string().url(),
  title: z.string(),
  source: z.string(),
  thumbnailUrl: z.string().url().nullable(),
});

export type FoundResource = z.infer<typeof FoundResource>;

/** The shared resource document that resource-scout keeps in the room, by slot. */
export const ResourceDocument = z.object({
  questId: z.string(),
  checkpoints: z.record(z.string(), z.array(FoundResource)),
});

export type ResourceDocument = z.infer<typeof ResourceDocument>;

export const GoalInput = z.object({
  goal: z.string().trim().min(3, 'Type at least 3 characters.').max(160),
});
