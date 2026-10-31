# 记忆规则

定义记忆、证据来源和模型操作的数据结构，判断可保留/可召回条件，计算记忆强度和本地日期。

不执行数据库读写、模型请求或宿主事件处理。

## 对外接口

跨功能调用统一从 `memory/index.ts` 导入。当前导出：

```ts
export {
  DEFAULT_SCOPE,
  Scope,
  type Source,
  type Snapshot,
  Proposal,
  type Alias,
  type Memory,
  visible,
  sameOwner,
  type SelfKind,
  type Presence,
  Knowledge,
  type Kind,
} from './model.js'
export {
  FORGET_THRESHOLD,
  isForgotten,
  memoryStrength,
  normalizeImportance,
  strengthCap,
} from './strength.js'
export { isRecallable, retentionRejection, isLowInformation } from './policy.js'
export { localDay } from './date.js'
```

## 目录内容

- `date.ts`
- `index.ts`
- `model.ts`
- `policy.ts`
- `strength.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
