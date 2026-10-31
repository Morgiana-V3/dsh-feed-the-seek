# 管理界面

提供 HTTP 管理接口、前后端共享响应契约，以及 React 设置页面。

服务调用使用 index.ts；浏览器构建从 client/index.tsx 进入，仅消费 contracts.ts 和浏览器可用模块。

## 对外接口

跨功能调用统一从 `dashboard/index.ts` 导入。当前导出：

```ts
export { createDashboard } from './server.js'
```

## 目录内容

- `client`
- `contracts.ts`
- `index.ts`
- `server.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
