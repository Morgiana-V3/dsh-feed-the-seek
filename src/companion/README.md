# 记忆协调

组合记忆规则、存储、人格、情绪和向量接口，提供记忆提案应用、索引、候选检索、稳定上下文与主动召回。

Engine 是协调入口；底层规则继续放在所属功能中，外部不引用 engine.ts。

## 对外接口

跨功能调用统一从 `companion/index.ts` 导入。当前导出：

```ts
export { Engine } from './engine.js'
```

## 目录内容

- `engine.ts`
- `index.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
