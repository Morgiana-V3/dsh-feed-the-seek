import * as React from 'react'
import type { Kind, Memory } from '../types.js'
import type { SettingsState } from './api.js'
import { dateLabel, projectLabel } from './api.js'

export const memoryKindLabels: Record<Kind, string> = {
  cognition: '知道的事',
  experience: '一起经历的',
  resonance: '我们之间',
  self: '关于我自己',
}

export const selfKindLabels: Record<string, string> = {
  behavior: '观察到的行为',
  feedback: '你的反馈',
  intention: '我的打算 · 还没做到',
  claim: '我自己说的 · 未验证',
  verified: '已验证的改变',
}

export const durabilityLabels: Record<string, string> = {
  situational: '仅限情境',
  habit: '习惯',
  lasting: '长期',
}

export { moodLabels } from '../mood.js'

/** Placeholder names from older versions are shown as "not named yet" rather than as a code-ish label. */
export function displayName(name: string | undefined): string {
  return !name || name === '初始实例' || name === '初始伙伴' ? '还没有名字的她' : name
}

// 12×12 pixel glyphs. Drawn as crisp rectangles so they match the Zpix font
// at every zoom level instead of depending on which fallback font has ◈ / ⚙.
const pixelGlyphs = {
  fish: [
    '............',
    '...####.....',
    '..######..##',
    '.########.##',
    '##.#######.#',
    '##########..',
    '##########..',
    '.##########.',
    '..######..##',
    '...####...##',
    '............',
    '............',
  ],
  overview: [
    '............',
    '.####..####.',
    '.####..####.',
    '.####..####.',
    '.####..####.',
    '............',
    '............',
    '.####..####.',
    '.####..####.',
    '.####..####.',
    '.####..####.',
    '............',
  ],
  memories: [
    '............',
    '.#########..',
    '.#.......#..',
    '.#.#####.#..',
    '.#.......#..',
    '.#.#####.#..',
    '.#.......#..',
    '.#.###...#..',
    '.#.......#..',
    '.#########..',
    '..#########.',
    '............',
  ],
  settings: [
    '.....##.....',
    '..#.####.#..',
    '.##########.',
    '..###..###..',
    '.###....###.',
    '####....####',
    '####....####',
    '.###....###.',
    '..###..###..',
    '.##########.',
    '..#.####.#..',
    '.....##.....',
  ],
  refresh: [
    '............',
    '....####.#..',
    '..##....##..',
    '.#.....###..',
    '.#..........',
    '#...........',
    '#...........',
    '.#.......#..',
    '.#.......#..',
    '..##....#...',
    '....####....',
    '............',
  ],
  cognition: [
    '.....##.....',
    '....#..#....',
    '...#....#...',
    '..#......#..',
    '.#........#.',
    '#....##....#',
    '#....##....#',
    '.#........#.',
    '..#......#..',
    '...#....#...',
    '....#..#....',
    '.....##.....',
  ],
  experience: [
    '............',
    '.##########.',
    '.#........#.',
    '.#.######.#.',
    '.#........#.',
    '.#.######.#.',
    '.#........#.',
    '.#.####...#.',
    '.#........#.',
    '.##########.',
    '............',
    '............',
  ],
  resonance: [
    '............',
    '.###...###..',
    '#####.#####.',
    '###########.',
    '###########.',
    '.#########..',
    '..#######...',
    '...#####....',
    '....###.....',
    '.....#......',
    '............',
    '............',
  ],
  self: [
    '.....#......',
    '.....#......',
    '....###.....',
    '....###.....',
    '.#########..',
    '...#####....',
    '....###.....',
    '....#.#.....',
    '...#...#....',
    '..#.....#...',
    '............',
    '............',
  ],
  search: [
    '............',
    '..####......',
    '.#....#.....',
    '#......#....',
    '#......#....',
    '#......#....',
    '#......#....',
    '.#....#.....',
    '..#####.....',
    '......###...',
    '.......###..',
    '........##..',
  ],
  download: [
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '..########..',
    '...######...',
    '....####....',
    '.....##.....',
    '............',
    '#..........#',
    '#..........#',
    '############',
  ],
  close: [
    '............',
    '.##......##.',
    '..##....##..',
    '...##..##...',
    '....####....',
    '.....##.....',
    '....####....',
    '...##..##...',
    '..##....##..',
    '.##......##.',
    '............',
    '............',
  ],
} as const

export type PixelGlyph = keyof typeof pixelGlyphs

const glyphPaths = Object.fromEntries(
  Object.entries(pixelGlyphs).map(([name, rows]) => [
    name,
    rows
      .flatMap((row, y) =>
        [...row].map((cell, x) => (cell === '#' ? `M${x} ${y}h1v1h-1z` : '')),
      )
      .join(''),
  ]),
) as Record<PixelGlyph, string>

export function PixelIcon({
  name,
  size = 12,
  className,
}: {
  name: PixelGlyph
  size?: number
  className?: string
}) {
  return (
    <svg
      className={'fish-icon' + (className ? ' ' + className : '')}
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path d={glyphPaths[name]} fill="currentColor" />
    </svg>
  )
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="fish-empty">
      <PixelIcon name="cognition" size={36} className="fish-empty-icon" />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

export function Toggle({
  label,
  description,
  checked,
  disabled,
  pending,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  pending?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="fish-toggle-row" data-checked={checked} aria-busy={pending || undefined}>
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className="fish-switch">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="fish-switch-track" aria-hidden="true" />
      </span>
    </label>
  )
}

/** Five-cell pixel meter; used for activation (recency decay). */
export function PixelMeter({ value, label }: { value: number; label: string }) {
  const filled = Math.max(0, Math.min(5, Math.round(value * 5)))
  return (
    <span
      className="fish-meter"
      role="img"
      aria-label={`${label} ${Math.round(value * 100)}%`}
      title={`${label} ${Math.round(value * 100)}%`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <i key={index} data-on={index < filled} />
      ))}
    </span>
  )
}

export function MemoryCard({
  memory,
  state,
  compact = false,
  isNew = false,
  index = 0,
  footer,
}: {
  memory: Memory & { activation?: number }
  state: SettingsState
  compact?: boolean
  isNew?: boolean
  index?: number
  footer?: React.ReactNode
}) {
  const related = (state.associations || [])
    .filter((association) => association.from === memory.id)
    .map((association) => ({
      association,
      memory: state.memories.find((candidate) => candidate.id === association.to),
    }))
    .filter((entry) => entry.memory?.status === 'active')
  return (
    <article
      className={`fish-memory-card fish-kind-border-${memory.kind}` + (isNew ? ' is-new' : '')}
      style={{ '--fish-index': Math.min(index, 8) } as React.CSSProperties}
    >
      <div className="fish-record-meta">
        <span className={`fish-kind fish-kind-${memory.kind}`}>
          {memoryKindLabels[memory.kind]}
        </span>
        <span>{memory.evidence === 'explicit' ? '你亲口说的' : '我猜的'}</span>
        {isNew && <span className="fish-new-badge">新</span>}
        <span className="fish-record-meta-end">
          {typeof memory.activation === 'number' && (
            <PixelMeter value={memory.activation} label="印象深浅" />
          )}
          <time dateTime={memory.updatedAt}>{dateLabel(memory.updatedAt)}</time>
        </span>
      </div>
      <p>{memory.text}</p>
      {!compact && (
        <>
          <div className="fish-tags">
            {memory.knowledge.domain && <span>{memory.knowledge.domain}</span>}
            {memory.knowledge.edition && <span>版本 {memory.knowledge.edition}</span>}
            {memory.scope.project && (
              <span title={memory.scope.project}>{projectLabel(memory.scope.project)}</span>
            )}
            {memory.kind === 'self' && memory.selfKind && (
              <span data-unverified={memory.selfKind === 'claim' || memory.selfKind === 'intention' || undefined}>
                {selfKindLabels[memory.selfKind]}
              </span>
            )}
            {memory.durability && memory.durability !== 'turn' && (
              <span>{durabilityLabels[memory.durability]}</span>
            )}
            {typeof memory.confidence === 'number' && (
              <span>把握 {Math.round(memory.confidence * 100)}%</span>
            )}
          </div>
          {memory.knowledge.conditions && (
            <p className="fish-muted">适用条件：{memory.knowledge.conditions}</p>
          )}
          {related.length > 0 && (
            <details className="fish-source fish-related">
              <summary>相关的记忆 · {related.length}</summary>
              <div className="fish-fold-body">
                {related.map((entry) => (
                  <blockquote key={entry.association.to}>
                    <p>{entry.memory!.text}</p>
                    <small>
                      {entry.association.reasons
                        .map((reason) =>
                          reason.startsWith('共同来源：') ? '同一条对话来源' : reason,
                        )
                        .join(' · ')}
                    </small>
                  </blockquote>
                ))}
              </div>
            </details>
          )}
          <details className="fish-source">
            <summary>当时的原话{memory.version > 1 ? ` · 改过 ${memory.version - 1} 次` : ''}</summary>
            <div className="fish-fold-body">
              {memory.sources.map((sourceId) => {
                const source = state.sources[sourceId]
                if (!source) {
                  return null
                }
                return (
                  <blockquote key={sourceId}>
                    <p>{source.text}</p>
                    <small>
                      {dateLabel(source.at)} · {source.session}
                    </small>
                  </blockquote>
                )
              })}
            </div>
          </details>
        </>
      )}
      {footer}
    </article>
  )
}

/**
 * Remembers which memory ids were present on the previous snapshot so newly
 * learned memories can flash once. Nothing is "new" on the first render.
 */
export function useNewMemoryIds(state: SettingsState): Set<string> {
  const seenRef = React.useRef<{ persona: string; ids: Set<string> } | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [fresh, setFresh] = React.useState<Set<string>>(() => new Set())
  const ids = state.memories.map((memory) => `${memory.id}:${memory.version}`).join('|')

  React.useEffect(() => {
    const current = new Set(state.memories.map((memory) => `${memory.id}:${memory.version}`))
    const seen = seenRef.current
    seenRef.current = { persona: state.scope.persona, ids: current }
    if (!seen || seen.persona !== state.scope.persona) {
      return
    }
    const added = [...current].filter((key) => !seen.ids.has(key)).map((key) => key.slice(0, key.lastIndexOf(':')))
    if (added.length > 0) {
      clearTimeout(timerRef.current)
      setFresh(new Set(added))
      timerRef.current = setTimeout(() => setFresh(new Set()), 6000)
    }
  }, [ids, state.scope.persona])

  React.useEffect(() => () => clearTimeout(timerRef.current), [])

  return fresh
}
