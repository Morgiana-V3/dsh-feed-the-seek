import * as React from 'react'
import type { Kind, Memory, Presence } from '../../memory/index.js'
import type { SettingsState } from '../contracts.js'
import { dateLabel } from './api.js'

export const memoryKindLabels: Record<Kind, string> = {
  cognition: '认知',
  experience: '经历',
  resonance: '共鸣',
  self: '自我',
}

export const selfKindLabels: Record<string, string> = {
  behavior: '观察到的行为',
  feedback: '你的反馈',
  intention: '我的打算 · 还没做到',
  claim: '我自己说的 · 未验证',
  verified: '已验证的改变',
}

export { moodLabels } from '../../emotion/index.js'

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
      .flatMap((row, y) => [...row].map((cell, x) => (cell === '#' ? `M${x} ${y}h1v1h-1z` : '')))
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
      <path
        d={glyphPaths[name]}
        fill="currentColor"
      />
    </svg>
  )
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="fish-empty">
      <PixelIcon
        name="cognition"
        size={36}
        className="fish-empty-icon"
      />
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
  inactive,
  className,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  pending?: boolean
  /** Shown but not in effect, e.g. while the master switch is off. */
  inactive?: boolean
  className?: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={'fish-toggle-row' + (className ? ' ' + className : '')}
      data-checked={checked}
      data-inactive={inactive || undefined}
      aria-busy={pending || undefined}
    >
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
        <span
          className="fish-switch-track"
          aria-hidden="true"
        />
      </span>
    </label>
  )
}

/**
 * One answer to "will this memory affect a conversation?", in place of the old
 * stated/guessed, precious and clarity marks that each described an internal field.
 */
/**
 * What background organizing is doing. A pending job that already carries an error failed once
 * and waits for its automatic retry; only "failed" needs the user.
 */
export function learningActivity(jobs: SettingsState['jobs']) {
  const working = jobs.filter(
    (job) => job.status === 'running' || (job.status === 'pending' && !job.error),
  )
  const retrying = jobs.filter((job) => job.status === 'pending' && !!job.error)
  const failed = jobs.filter((job) => job.status === 'failed')
  // Jobs are newest first; the latest reason is the one worth showing.
  const reason = (failed[0] || retrying[0])?.error?.replace(/^\w*Error:\s*/, '') || ''
  return { working: working.length, retrying: retrying.length, failed: failed.length, reason }
}

export const presenceLabels: Record<Presence, { label: string; hint: string }> = {
  pinned: { label: '常驻', hint: '每次对话都会带上：称呼、性格、你的长期要求和最近的自我变化。' },
  topical: { label: '相关时想起', hint: '话题相关时自动想起。' },
  faded: { label: '已淡忘', hint: '很久没用到，不再自动想起；主动回忆时仍能找到。' },
  record: { label: '仅作记录', hint: '未经验证的自我描述，只保留记录，不参与对话。' },
}

export function PresenceTag({ presence }: { presence?: Presence }) {
  if (!presence) {
    return null
  }
  const { label, hint } = presenceLabels[presence]
  return (
    <span
      className="fish-presence"
      data-presence={presence}
      title={hint}
    >
      <i aria-hidden="true" />
      {label}
    </span>
  )
}

export function MemoryCard({
  memory,
  compact = false,
  isNew = false,
  index = 0,
  footer,
}: {
  memory: Memory & { presence?: Presence }
  state: SettingsState
  compact?: boolean
  isNew?: boolean
  index?: number
  footer?: React.ReactNode
}) {
  // Edition and conditions are real limits; the free-written topic label is not shown.
  const limits = [
    memory.knowledge.edition && `版本 ${memory.knowledge.edition}`,
    memory.knowledge.conditions,
  ]
    .filter(Boolean)
    .join('；')
  return (
    <article
      className={`fish-memory-card fish-kind-border-${memory.kind}` + (isNew ? ' is-new' : '')}
      style={{ '--fish-index': Math.min(index, 8) } as React.CSSProperties}
    >
      <div className="fish-record-meta">
        <span className={`fish-kind fish-kind-${memory.kind}`}>
          {memoryKindLabels[memory.kind]}
        </span>
        <PresenceTag presence={memory.presence} />
        {/* Self observations carry their own basis below; elsewhere only a guess is worth flagging. */}
        {memory.kind !== 'self' && memory.evidence === 'inferred' && (
          <span
            className="fish-inferred"
            title="根据对话推测，不是你直接说的；不对的话在对话里纠正即可。"
          >
            推测
          </span>
        )}
        {memory.kind === 'self' && memory.selfKind && (
          <span
            className="fish-self-basis"
            data-unverified={
              memory.selfKind === 'claim' || memory.selfKind === 'intention' || undefined
            }
          >
            {selfKindLabels[memory.selfKind]}
          </span>
        )}
        {isNew && <span className="fish-new-badge">新</span>}
        <span className="fish-record-meta-end">
          <time dateTime={memory.updatedAt}>{dateLabel(memory.updatedAt)}</time>
        </span>
      </div>
      <p>{memory.text}</p>
      {!compact && <>{limits && <p className="fish-muted">适用条件：{limits}</p>}</>}
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
    const added = [...current]
      .filter((key) => !seen.ids.has(key))
      .map((key) => key.slice(0, key.lastIndexOf(':')))
    if (added.length > 0) {
      clearTimeout(timerRef.current)
      setFresh(new Set(added))
      timerRef.current = setTimeout(() => setFresh(new Set()), 6000)
    }
  }, [ids, state.scope.persona])

  React.useEffect(() => () => clearTimeout(timerRef.current), [])

  return fresh
}
