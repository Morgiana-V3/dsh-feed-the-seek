# 独立演示

提供隔离演示数据、演示步骤和本地管理页启动程序。

index.ts 仅导出演示数据 API；main.ts 是进程入口，由 src/server.ts 启动，不从公开 API 隐式启动服务。

## 对外接口

跨功能调用统一从 `demo/index.ts` 导入。当前导出：

```ts
export { seedDemo, demoStep, DEMO_SCOPE } from './fixtures.js'
```

## 目录内容

- `fixtures.ts`
- `index.ts`
- `main.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
