# 设置模型

维护插件设置的 schema、默认值和推导类型。

定义设置结构，不操作界面和数据库。

## 对外接口

跨功能调用统一从 `settings/index.ts` 导入。当前导出：

```ts
export { Settings } from './model.js'
```

## 目录内容

- `index.ts`
- `model.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
