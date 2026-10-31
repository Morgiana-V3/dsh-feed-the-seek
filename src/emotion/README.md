# 情绪展示

定义情绪输入和状态模型，选择当前展示情绪、强度标签及对应素材。

保持规则可独立计算，不发网络请求或读写数据库。

## 对外接口

跨功能调用统一从 `emotion/index.ts` 导入。当前导出：

```ts
export {
  moodLabels,
  pickDisplayedMood,
  strengthLabel,
  type DisplayedMood,
  moodAsset,
  MIN_DWELL_MS,
} from './display.js'
export { type State, StateInput, type Mood } from './model.js'
```

## 目录内容

- `display.ts`
- `index.ts`
- `model.ts`

修改接口后同步调用方及对应测试，并运行 `npm run check:boundaries` 与 `npm test`。
