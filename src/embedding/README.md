# 向量服务

适配向量协议，验证向量与连接，并解析端点绑定的凭据。

不负责记忆选择或向量落库；凭据服务由调用者注入。

## 对外接口

跨功能调用统一从 `embedding/index.ts` 导入。当前导出：

```ts
export { makeEmbedder, type Embedder, validateVector } from './embedder.js'
export {
  resolveEmbeddingKey,
  type EmbeddingCredentials,
  ApiKey,
  embeddingKeyReference,
} from './credentials.js'
export { testEmbeddingConnection } from './connection.js'
```

## 目录内容

- `connection.ts`
- `credentials.ts`
- `embedder.ts`
- `index.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
