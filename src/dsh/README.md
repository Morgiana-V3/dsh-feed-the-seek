# DSH 接入

负责宿主模块发现、事件接入、会话上下文注入、回忆工具、模型参数协商和管理页挂载。

不复制记忆规则；包根入口 src/dsh.ts 仅转出该功能的插件接口。

## 对外接口

跨功能调用统一从 `dsh/index.ts` 导入。当前导出：

```ts
export { apply, traceLine, usedItems, name, inject, type Config } from './plugin.js'
export { learningCallOptions } from './model-options.js'
```

## 目录内容

- `dashboard-host.ts`
- `index.ts`
- `model-options.ts`
- `plugin.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
