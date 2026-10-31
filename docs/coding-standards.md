# 代码写作约定

本项目的整理范围为 `src/`、`tests/`、`scripts/` 与手写的 `public/app.js`、CSS、HTML。`dist/` 与 `public/client.js` 是构建产物，通过构建同步，不直接格式化或修改。

- UTF-8、LF、2 空格缩进、100 字符目标行宽、单引号、不写语句尾分号。长 URL、提示词正文与协议字符串不强行断行。
- 每行一条语句，每次声明一个变量；分支和循环必须有花括号。按读取、校验、计算、保存等步骤留空行。
- 禁止嵌套三元、逗号表达式、多层赋值和短路表达式中的副作用。多条件业务提取为具名函数或显式分支。
- 变量与回调参数表达业务角色，例如 `memory`、`source`、`operation`、`request`。重命名通过符号引用完成，保持数据库、HTTP、DSH 和模型 JSON 字段不变。
- 模块按职责拆分；提示词放在所属功能的 `prompts/` 子目录（如 `src/learning/prompts/`），使用 `import { dedent } from 'ts-dedent'` 和 `dedent` 标签模板。跨功能引用只使用该功能的 `index.ts`，入口和职责见[架构说明](architecture.md)。调整缩进不能改变模型收到的正文。
- React 展示逻辑尽量使用具名派生值；多个 JSX 属性分行。CSS 规则与声明展开，不改变选择器优先级和声明覆盖顺序。
- 不以格式检查代替命名、职责和行为审查，不为纯排版增加业务测试。

## 检查与修复

| 只检查 | 自动修复 | 范围 |
| --- | --- | --- |
| `npm run format:check` | `npm run format` | 源码、脚本、测试、手写前端与工程配置 |
| `npm run lint` | `npm run lint:fix` | TS、TSX、JS 的分支、声明和表达式结构；提示词标签 |
| `npm run lint:styles` | `npm run lint:styles:fix` | 手写 CSS 的属性、单位、颜色、重复声明和简写覆盖 |

`npm run check:all` 汇总以上检查、功能依赖边界与 TypeScript 类型检查；`npm test` 构建并运行回归测试。ESLint 当前只负责列出的结构规则，没有启用完整的类型感知 Promise 检查。样式检查不自动排序声明。

GitHub 直装发布前还需执行 `npm run check:release`，并提交最新 `dist/src/` 与 `public/client.js`。本地开发状态、数据库与个人路径不属于分发内容。
