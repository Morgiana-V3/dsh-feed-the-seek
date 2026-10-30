import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Store } from './store.js'
import type { Memory, Scope, SelfKind } from './types.js'
import { sameOwner } from './types.js'
import { resolveIndexes } from './persona.js'

/**
 * Self observations barely fade, so they need their own compaction (from the earlier bot's
 * "self 精炼"). Above the limit the model proposes merges by index; the code adds the merged
 * observation first and retires the originals after, then checks the count really went down.
 */
export const SELF_LIMIT = 20

export const SELF_CONSOLIDATION_PROMPT = `下面是角色的自我观察，带序号。条目过多，需要把说同一件事、同一情境的观察合并成一条。只输出 JSON：{"merged":[{"text":"合并后的一句话，60字以内","sourceIndexes":[0,4],"selfKind":"behavior|feedback|intention|claim|verified"}]}。
合并后的 text 用角色自己的口吻写：“我”指角色，“你”指用户。只合并含义相同的条目；不同情境下的不同表现不是矛盾，不要合并。同一情境前后不一致时保留较新的说法。selfKind 取被合并条目中证据最弱的那一类（claim/intention 最弱）。没有可合并的返回 {"merged":[]}。`

const Merge = z.object({ merged: z.array(z.object({ text: z.string().trim().min(1).max(200), sourceIndexes: z.array(z.unknown()).max(20), selfKind: z.string().optional() })).max(10) })
const STRENGTH: Record<SelfKind, number> = { claim: 0, intention: 0, feedback: 1, behavior: 2, verified: 3 }

/** The merged observation can only claim what its sources jointly support. */
function weakestKind(sources: Memory[]): SelfKind {
  return sources.map((memory) => memory.selfKind || 'claim').sort((a, b) => STRENGTH[a] - STRENGTH[b])[0]
}

export function selfObservations(store: Store, scope: Scope): Memory[] {
  return store.memories().filter((memory) => memory.kind === 'self' && sameOwner(memory.scope, scope)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function consolidateSelf(store: Store, scope: Scope, generate: (system: string, user: string, signal: AbortSignal) => Promise<string>, signal: AbortSignal) {
  const all = selfObservations(store, scope)
  if (all.length <= SELF_LIMIT) return undefined
  // Observations behind a formed tendency are left alone; merging them would withdraw it.
  const items = all.filter((memory) => !store.trait(memory.id)).slice(-200)
  const raw = await generate(SELF_CONSOLIDATION_PROMPT, JSON.stringify(items.map((memory, index) => ({ index, text: memory.text, scope: memory.scope, knowledge: memory.knowledge, selfKind: memory.selfKind || 'claim', date: memory.createdAt.slice(0, 10) }))), signal)
  const proposal = Merge.parse(JSON.parse(raw.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')))
  const used = new Set<number>()
  const now = new Date().toISOString()
  let merged = 0
  store.transaction(() => {
    for (const entry of proposal.merged) {
      const indexes = resolveIndexes(entry.sourceIndexes, items.length).filter((index) => !used.has(index))
      if (indexes.length < 2 || [...entry.text].length > 60) continue
      const originals = indexes.map((index) => items[index])
      const first = originals[0]
      const sameContext = originals.every((memory) =>
        memory.scope.project === first.scope.project &&
        memory.knowledge.domain === first.knowledge.domain &&
        memory.knowledge.edition === first.knowledge.edition &&
        memory.knowledge.conditions === first.knowledge.conditions &&
        memory.durability === first.durability,
      )
      if (!sameContext) {
        continue
      }
      indexes.forEach((index) => used.add(index))
      const next: Memory = {
        id: randomUUID(), kind: 'self', text: entry.text, tags: [...new Set(originals.flatMap((memory) => memory.tags))].slice(0, 8),
        scope: originals[0].scope, evidence: originals.every((memory) => memory.evidence === 'explicit') ? 'explicit' : 'inferred',
        importance: Math.max(...originals.map((memory) => memory.importance)), status: 'active', version: 1,
        sources: [...new Set(originals.flatMap((memory) => memory.sources))], createdAt: originals.map((memory) => memory.createdAt).sort()[0], updatedAt: now,
        knowledge: first.knowledge, durability: first.durability,
        confidence: Math.min(...originals.map((memory) => memory.confidence)), selfKind: weakestKind(originals),
      }
      // Add first, retire after: if anything fails the worst case is one extra observation.
      store.put(next)
      store.audit('MERGE', `自我观察精炼：合并 ${originals.length} 条`, undefined, next)
      for (const original of originals) {
        const retired: Memory = { ...original, status: 'inactive', version: original.version + 1, updatedAt: now }
        store.put(retired)
        store.audit('MERGE', '已并入新的自我观察', original, retired)
      }
      merged++
    }
  })
  const after = selfObservations(store, scope).length
  if (merged > 0 && after >= all.length) store.audit('NONE', `自我观察精炼后条目数没有减少（${all.length} → ${after}），请检查合并结果`)
  return { before: all.length, after, merged }
}
