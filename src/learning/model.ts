import type { Scope, Source } from '../memory/index.js'

export type Generator = (system: string, user: string, signal: AbortSignal) => Promise<string>

/** sources are new events; context holds earlier events of the same turn that a previous checkpoint already organized. */
export interface LearningJob {
  id: string
  scope: Scope
  sources: Source[]
  context?: Source[]
  provider?: string
  model?: string
  /** Folder name of the conversation, only as a hint for project conventions. */ workspace?: string
}
