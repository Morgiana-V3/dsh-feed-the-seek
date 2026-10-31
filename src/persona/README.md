# 人格成长

管理人格证据、版本和合成，合并重复自我观察，并渲染人格上下文。

人格合成与自我合并的提示词都在本目录 prompts/ 内；不接收宿主事件。

## 对外接口

跨功能调用统一从 `persona/index.ts` 导入。当前导出：

```ts
export {
  loadPersona,
  renderPersona,
  isPersonaEvidence,
  notePersonaObservation,
  synthesizePersona,
  personaHistory,
  PERSONA,
  type PersonaDiff,
  type PersonaDoc,
  applyPersonaEdits,
  emptyPersona,
  resolveIndexes,
  sessionScenes,
} from './synthesis.js'
export { consolidateSelf, SELF_LIMIT, selfObservations } from './consolidation.js'
export { type Persona, type Trait } from './model.js'
```

## 目录内容

- `consolidation.ts`
- `index.ts`
- `model.ts`
- `prompts`
- `synthesis.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
