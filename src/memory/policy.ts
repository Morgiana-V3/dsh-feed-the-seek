import type { Memory, Operation, Source } from './model.js'

/** Event timestamps are metadata, not evidence of when the described event happened. */
function calendarDates(text: string): string[] {
  return [...text.matchAll(/(?<!\d)(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日)?(?!\d)/g)].map(
    (match) => `${Number(match[1])}-${Number(match[2])}-${Number(match[3])}`,
  )
}

/** Only obvious acknowledgements/arithmetic are skipped; ambiguous feedback still reaches the organizer. */
export function isLowInformation(text: string): boolean {
  const compact = text
    .trim()
    .replace(/[\s，。！？,.!？!~～]/g, '')
    .replace(/只回复[“"「](?:你好|您好|hi|hello)[”"」]$/i, '')
  if (!compact) {
    return true
  }
  if (
    /^(?:(?:你好|您好|嗨|哈喽|好的?|嗯+|哦+|收到|谢谢你?|多谢|辛苦了?|先这样|再见|晚安|早安|早上好|ok|okay|thanks|thankyou|hi|hello|bye))+$/i.test(
      compact,
    )
  ) {
    return true
  }
  return /^(?:请(?:计算|算一下)?|计算|算一下)?\d+(?:\.\d+)?(?:乘以?|加上?|减去?|除以?|[+*×÷/−-])\d+(?:\.\d+)?(?:等于多少|是多少|等于|=)(?:只给数字|只回复数字)?$/.test(
    compact,
  )
}

/** Eligibility for model-visible memory; legacy promises remain inspectable without steering replies. */
export function isRecallable(memory: Memory): boolean {
  if (memory.kind !== 'self') {
    return true
  }
  if (memory.selfKind === 'feedback') {
    return true
  }
  return (
    (memory.selfKind === 'behavior' || memory.selfKind === 'verified') &&
    memory.retention?.basis === 'feedback'
  )
}

/** Semantic importance is model judged, but source/category requirements are enforced in code. */
export function retentionRejection(
  operation: Operation,
  kind: Memory['kind'],
  sources: Source[],
  quoteSupported: boolean,
): string {
  if (operation.action === 'DELETE' || operation.action === 'NONE') {
    return ''
  }
  if (!operation.retention) {
    return '缺少长期保留依据；操作经过本身不构成长期价值'
  }
  if (!quoteSupported) {
    return '长期保留需要用户原话支持，助手表态或工具成功不足以入选'
  }
  const basis = operation.retention.basis
  if (kind === 'experience') {
    const supportedDates = new Set(
      sources
        .filter((source) => source.role === 'user')
        .flatMap((source) => calendarDates(source.text)),
    )
    const claimedDates = calendarDates(
      [
        operation.text,
        operation.knowledge.domain,
        operation.knowledge.edition,
        operation.knowledge.conditions,
      ].join('\n'),
    )
    if (claimedDates.some((date) => !supportedDates.has(date))) {
      return '经历中的具体日期必须来自用户正文，不能把消息或记忆的时间戳当作事件日期；日期不明时保留原始相对时间'
    }
  }
  if (kind === 'experience' && !['milestone', 'relationship'].includes(basis)) {
    return '经历只保留改变了你们关系或对你有分量的事，不保存日常工作汇报'
  }
  if (kind === 'self') {
    if (basis !== 'feedback') {
      return '自我观察需要具体反馈依据'
    }
    if (!operation.selfKind || ['intention', 'claim'].includes(operation.selfKind)) {
      return '承诺、打算与助手自评不进入长期记忆'
    }
    if (
      ['behavior', 'verified'].includes(operation.selfKind) &&
      /我(?:以后|今后|下次|将来)?(?:会|将|打算|准备|保证)/.test(operation.text || '')
    ) {
      return '未来表态不能标成已经观察或验证的行为'
    }
    if (
      ['behavior', 'verified'].includes(operation.selfKind) &&
      !sources.some((candidateSource) => candidateSource.role === 'tool')
    ) {
      return '行为观察需要可核对的工具轨迹'
    }
  }
  if (kind === 'resonance' && basis !== 'relationship') {
    return '共鸣需要具体事件带来的长期情感意义依据'
  }
  if (kind === 'cognition' && !['knowledge', 'preference', 'relationship'].includes(basis)) {
    return '认知需要具体知识、稳定偏好或称呼依据'
  }
  return ''
}
