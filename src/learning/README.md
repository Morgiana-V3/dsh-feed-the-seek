# 后台学习

管理整理任务、构建模型输入、解析和修复提案、提交变化，并安排人格和自我观察维护。

模型调用通过 Generator 注入，不直接访问 DSH SDK；任务 SQL 由 storage.jobs 提供。

## 对外接口

跨功能调用统一从 `learning/index.ts` 导入。当前导出：

```ts
export { Learner } from './learner.js'
export { type Generator, type LearningJob } from './model.js'
export { generateProposal } from './proposal.js'
```

## 目录内容

- `index.ts`
- `learner.ts`
- `model.ts`
- `prompts`
- `proposal.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
