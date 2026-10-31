import * as React from 'react'
import type { Kind } from '../../memory/index.js'
import type { SettingsState } from '../contracts.js'
import {
  EmptyState,
  MemoryCard,
  PixelIcon,
  displayName,
  memoryKindLabels,
  learningActivity,
} from './components.js'

export function OverviewPanel({
  state,
  isBusy,
  newMemoryIds,
  onOpenMemories,
  onRetry,
}: {
  state: SettingsState
  isBusy: boolean
  newMemoryIds: Set<string>
  onOpenMemories: (kind?: Kind | 'all') => void
  onRetry: () => void
}) {
  const persona = state.personas.find((entry) => entry.id === state.scope.persona)
  const memories = state.memories.filter((memory) => memory.status === 'active')
  const latestMemories = memories
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 3)
  const mood = state.mood
  const activeAliases = state.memories.filter(
    (memory) => memory.status === 'active' && memory.alias,
  )
  const latestAlias = (kind: string) =>
    activeAliases
      .filter((memory) => memory.alias!.kind === kind)
      .sort((leftMemory, rightMemory) =>
        rightMemory.updatedAt.localeCompare(leftMemory.updatedAt),
      )[0]?.alias!.value
  const naming = { address: latestAlias('user_preferred'), name: latestAlias('assistant_name') }
  // A placeholder companion name gives way to the name she was given in conversation.
  const hasOwnName = displayName(persona?.name) === persona?.name
  let moodText = '情绪表达已关闭'
  if (mood) {
    moodText = mood.strength ? `${mood.strength}${mood.label}` : mood.label
  }
  const activity = learningActivity(state.jobs)
  let learningStatus = '等待下一次对话'
  let learningTone: 'idle' | 'running' | 'retrying' | 'failed' | 'paused' = 'idle'
  if (!state.settings.enabled || !state.settings.learning) {
    learningStatus = '暂时不记新的事'
    learningTone = 'paused'
  } else if (activity.working > 0) {
    learningStatus = '正在回想刚才的事'
    learningTone = 'running'
  } else if (activity.failed > 0) {
    learningStatus = `有 ${activity.failed} 段对话没记下来`
    learningTone = 'failed'
  } else if (activity.retrying > 0) {
    learningStatus = '刚才没整理好，稍后会自动再试'
    learningTone = 'retrying'
  } else if (state.jobs.length > 0) {
    learningStatus = '已整理，只留下值得记的'
  }

  return (
    <div>
      <div className="fish-profile">
        <div
          className="fish-portrait-frame"
          data-mood={mood?.asset || 'calm'}
        >
          {/* Keep inactive portraits static so only the visible mood decodes an animation. */}
          {portraitMoods.map((asset) => (
            <picture key={asset}>
              <source
                media="(prefers-reduced-motion: reduce)"
                srcSet={`/fish-brain/assets/portrait-${asset}.png`}
              />
              <img
                className="fish-portrait"
                data-active={asset === (mood?.asset || 'calm') || undefined}
                src={`/fish-brain/assets/portrait-${asset}.${asset === (mood?.asset || 'calm') ? 'webp' : 'png'}?v=5`}
                alt={asset === (mood?.asset || 'calm') ? portraitAlt[asset] : ''}
                aria-hidden={asset === (mood?.asset || 'calm') ? undefined : true}
                width="296"
                height="364"
                decoding="async"
              />
            </picture>
          ))}
        </div>
        <div className="fish-profile-info">
          <div className="fish-eyebrow">
            {state.scope.persona === state.activePersona ? '正在陪你' : '以前的她'}
          </div>
          <h2>{hasOwnName ? persona!.name : naming.name || displayName(undefined)}</h2>
          <span
            className="fish-status"
            data-off={!state.settings.enabled || undefined}
          >
            <i aria-hidden="true" />
            {state.settings.enabled ? '记得你' : '暂时不用记忆'}
          </span>
          <div className="fish-profile-divider" />
          <dl>
            <div>
              <dt>心情</dt>
              <dd
                className="fish-mood"
                data-mood={mood?.asset}
                data-off={!mood || undefined}
              >
                {moodText}
              </dd>
            </div>
            {mood?.reason && <p className="fish-mood-reason">{mood.reason}</p>}
            {hasOwnName && naming.name && naming.name !== persona?.name && (
              <div>
                <dt>你叫我</dt>
                <dd>{naming.name}</dd>
              </div>
            )}
            {naming.address && (
              <div>
                <dt>我叫你</dt>
                <dd>{naming.address}</dd>
              </div>
            )}
            <div>
              <dt>回想</dt>
              <dd
                className="fish-learning"
                data-tone={learningTone}
              >
                <i aria-hidden="true" />
                {learningStatus}
                {learningTone === 'failed' && (
                  <button
                    type="button"
                    className="fish-text-button"
                    disabled={isBusy}
                    onClick={onRetry}
                  >
                    再想想
                  </button>
                )}
                {(learningTone === 'failed' || learningTone === 'retrying') && activity.reason && (
                  <small
                    className="fish-learning-reason"
                    title={activity.reason}
                  >
                    原因：{activity.reason}
                  </small>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div
        className="fish-memory-counts"
        aria-label="记忆数量"
      >
        {(Object.entries(memoryKindLabels) as [Kind, string][]).map(([kind, label]) => {
          const count = memories.filter((memory) => memory.kind === kind).length
          return (
            <button
              key={kind}
              type="button"
              className={`fish-counter fish-counter-${kind}`}
              onClick={() => onOpenMemories(kind)}
              aria-label={`${label} ${count} 条，查看`}
            >
              <span className="fish-counter-label">
                <PixelIcon name={kind} />
                {label}
              </span>
              <strong key={count}>{count}</strong>
            </button>
          )
        })}
      </div>
      <div className="fish-section-heading">
        <h3>最近记住的</h3>
        <button
          type="button"
          className="fish-text-button"
          onClick={() => onOpenMemories('all')}
        >
          全部记忆 <span aria-hidden="true">→</span>
        </button>
      </div>
      {latestMemories.length > 0 ? (
        latestMemories.map((memory, index) => (
          <MemoryCard
            key={memory.id}
            memory={memory}
            state={state}
            compact
            index={index}
            isNew={newMemoryIds.has(memory.id)}
          />
        ))
      ) : (
        <EmptyState title="还没有记住什么">聊过几次之后，我记住的事会出现在这里。</EmptyState>
      )}
      <PersonaFold state={state} />
    </div>
  )
}

const portraitMoods = [
  'calm',
  'happy',
  'discouraged',
  'annoyed',
  'concerned',
  'relieved',
  'hopeful',
  'shy',
] as const
const portraitAlt: Record<(typeof portraitMoods)[number], string> = {
  calm: '蓝发鲸鱼娘女仆，抱着笔记本微笑',
  happy: '蓝发鲸鱼娘女仆，笑着挥手',
  discouraged: '蓝发鲸鱼娘女仆，抱着尾巴有些低落',
  annoyed: '蓝发鲸鱼娘女仆，抱着手臂有点不满',
  concerned: '蓝发鲸鱼娘女仆，前倾攥着围裙，担心地望向你',
  relieved: '蓝发鲸鱼娘女仆，双手轻合，露出安心的微笑',
  hopeful: '蓝发鲸鱼娘女仆，举起双拳，满怀期待',
  shy: '蓝发鲸鱼娘女仆，侧身回望，用尾鳍遮住害羞的脸',
}

const sectionTitles: Record<string, string> = {
  self: '我是什么样的人',
  scenes: '我在不同场合',
  values: '我在意的事',
}

/** "Who she is", with how much evidence stands behind each line and progress to the next synthesis. */
function PersonaFold({ state }: { state: SettingsState }) {
  const persona = state.persona
  const sections = persona
    ? (Object.entries(persona.sections) as [string, { text: string; evidence: string[] }[]][])
    : []
  const filled = sections.filter(([, lines]) => lines.length > 0)
  const total = filled.reduce((sum, [, lines]) => sum + lines.length, 0) + state.traits.length
  const latest = persona?.history[0]
  return (
    <details className="fish-fold fish-persona">
      <summary>
        我是什么样的人 <span>{total} 条</span>
      </summary>
      <div className="fish-fold-body">
        {filled.map(([section, lines]) => (
          <section
            key={section}
            className="fish-persona-section"
          >
            <h4>{sectionTitles[section]}</h4>
            {lines.map((line, index) => (
              <p
                key={index}
                className="fish-trait"
              >
                {line.text}
              </p>
            ))}
          </section>
        ))}
        {state.traits.length > 0 && (
          <section className="fish-persona-section">
            <h4>稳定倾向</h4>
            {state.traits.map((trait) => (
              <p
                key={trait.id}
                className="fish-trait"
              >
                {trait.text}
              </p>
            ))}
          </section>
        )}
        {total === 0 && (
          <p className="fish-muted">
            还没有形成。你的反馈和我的表现在不同场合或好几天里都一致，才会写进这里。
          </p>
        )}
        {latest && (latest.diff.added.length > 0 || latest.diff.updated.length > 0) && (
          <p className="fish-muted">
            最近的变化：
            {[
              ...latest.diff.added.map((text) => `新增「${text}」`),
              ...latest.diff.updated.map((entry) => `「${entry.from}」→「${entry.to}」`),
            ].join('；')}
          </p>
        )}
      </div>
    </details>
  )
}
