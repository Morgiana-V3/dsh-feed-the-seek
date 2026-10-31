# 文本脱敏

提供凭据文本、来源记录与 JSON 字符串的脱敏函数。

只处理输入输出，不决定记忆保留规则或记录日志。

## 对外接口

跨功能调用统一从 `privacy/index.ts` 导入。当前导出：

```ts
export { redactJsonText, safeSource, redactSecrets } from './redaction.js'
```

## 目录内容

- `index.ts`
- `redaction.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
