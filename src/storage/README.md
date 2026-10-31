# 本地存储

封装 SQLite 初始化、迁移、事务、记忆、来源、状态、向量、统计和任务持久化。

任务仓库 jobs.ts 是内部实现，对外通过 Store.jobs 使用；业务模块禁止访问 Store.db，底层测试可以检查数据库。

## 对外接口

跨功能调用统一从 `storage/index.ts` 导入。当前导出：

```ts
export { Store, type LearningUsage } from './store.js'
```

## 目录内容

- `index.ts`
- `jobs.ts`
- `store.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
