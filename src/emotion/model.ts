import { z } from 'zod'
import type { Scope } from '../memory/index.js'

/** steady is the pre-0.2.15 name of calm; it stays readable so stored states keep working. */
export const Mood = z.enum([
  'calm',
  'happy',
  'hopeful',
  'concerned',
  'discouraged',
  'annoyed',
  'shy',
  'relieved',
  'steady',
])

export type Mood = z.infer<typeof Mood>

export const StateInput = z
  .object({
    mood: Mood,
    reason: z.string().trim().min(1).max(400),
    behavior: z.string().trim().min(1).max(400),
    intensity: z.number().min(0).max(0.7),
    sources: z.array(z.string()).min(1).max(12),
    topic: z.string().trim().min(1).max(100),
    /** How the character reads the event, including what is still uncertain. */
    appraisal: z.string().trim().max(300).optional(),
    /** One short line for the UI; technical detail stays in the linked experience. */
    displayReason: z.string().trim().max(40).optional(),
    /** Certainty of this emotional reading; not the same as intensity. */
    confidence: z.number().min(0).max(1).optional(),
    /** Memory the state reacts to (a candidate id, or "op:N" for a memory created in the same batch). */
    target: z.string().max(100).optional(),
    /** relationship = how she feels about the two of you; task = a reaction to the work at hand (fades sooner in wording only). */
    layer: z.enum(['task', 'relationship']).optional(),
  })
  .strict()

export type StateInput = z.infer<typeof StateInput>

export interface State extends StateInput {
  id: string
  scope: Scope
  updatedAt: string
  onsetAt?: string
  resolvedAt?: string
  effectiveIntensity: number
}
