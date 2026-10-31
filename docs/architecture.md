# 按功能组织的模块

每个功能在 `src/<功能>/` 中集中维护实现、模型、提示词和职责说明，通过 `index.ts` 提供外部调用接口。跨功能引用不得绕过公开入口；功能内部可以直接引用同目录实现文件。

| 功能目录 | 负责什么 | 主要入口 |
| --- | --- | --- |
| [memory](../src/memory/README.md) | 记忆模型、保留规则、强度衰减、日期 | schema、规则与计算函数 |
| [companion](../src/companion/README.md) | 协调写入、检索、索引与上下文 | `Engine` |
| [learning](../src/learning/README.md) | 后台整理任务、模型提案与后续维护 | `Learner`、`Generator` |
| [persona](../src/persona/README.md) | 人格合成、自我观察合并、证据与版本 | 人格读取、合成、合并函数 |
| [emotion](../src/emotion/README.md) | 情绪模型、显示选择和素材映射 | 状态类型、情绪选择函数 |
| [embedding](../src/embedding/README.md) | 向量协议、连接测试、凭据解析 | `makeEmbedder`、`testEmbeddingConnection` |
| [settings](../src/settings/README.md) | 设置校验与默认值 | `Settings` |
| [storage](../src/storage/README.md) | SQLite、事务、迁移与任务仓库 | `Store`，任务操作通过 `store.jobs` |
| [privacy](../src/privacy/README.md) | 来源和模型输入的凭据脱敏 | `safeSource`、`redactSecrets` |
| [dashboard](../src/dashboard/README.md) | 管理 API、响应契约、React 设置页 | `createDashboard`，客户端构建入口 `client/index.tsx` |
| [dsh](../src/dsh/README.md) | 宿主事件、上下文注入、回忆工具与生命周期 | 插件 `apply` |
| [demo](../src/demo/README.md) | 演示数据与独立运行 | `seedDemo`、`demoStep`；进程入口 `main.ts` |

## 引用方式

```ts
import { Learner, type Generator } from '../learning/index.js'
import { Store } from '../storage/index.js'
```

其他功能不导入 `learning/learner.js` 或 `storage/jobs.js`。新增公开接口应在所属功能的 `index.ts` 明确导出，避免通过 `export *` 意外暴露内部实现。只供模块自己使用的工具、提示词和组件留在内部。

`src/dsh.ts` 和 `src/server.ts` 是保留既有包入口、启动命令的薄入口。只有独立进程入口可以加载 `demo/main.ts`；导入功能公开 API 不会启动 HTTP 服务。

## 依赖约束

- DSH 接入与管理接口调用记忆协调、后台学习等功能，底层规则不依赖宿主和 UI。
- 学习流程通过注入的 `Generator` 请求模型，不直接加载 DSH SDK。
- 只有 `storage` 可以执行数据库操作。学习任务的恢复、入队、开始、完成、失败、重试和列表查询通过 `Store.jobs` 完成；它与记忆使用同一连接，参与同一事务。
- 前后端响应模型集中在 `dashboard/contracts.ts`。服务端构建的状态使用 `satisfies SettingsState` 检查；浏览器请求仍需处理 HTTP 和 JSON 解析错误。
- 浏览器代码不能导入 Node.js 或 HTTP 服务实现。仅类型引用不会引入服务端运行时，但也须经过功能公开入口。
- `memory` 的提案 schema 使用 `emotion` 的状态 schema；情绪模型反向引用的 `Scope` 仅为类型，不形成运行时循环。

`npm run check:boundaries` 检查源码和测试中的静态导入/导出：公开入口、允许的运行时依赖、数据库访问归属、浏览器与服务端边界、运行时循环。允许依赖清单在 `scripts/checks/check-boundaries.mjs` 中显式维护。动态宿主加载由 DSH 集成测试覆盖。

## 测试与工程脚本

测试在 `tests/<功能>/` 中按被验证的功能归属。跨功能集成场景放在协调层测试中，例如 `tests/companion/memory-layers.test.ts`。现有大测试文件可以继续按业务场景逐步拆分，不需要随目录迁移一起改变断言。

脚本在 `scripts/` 下按用途组织，所有命令从项目根目录运行：

| 目录 | 用途 |
| --- | --- |
| `build/` | 类型检查、清理编译器产物、构建后端和客户端 |
| `checks/` | 架构依赖检查 |
| `development/` | 开发链接、监听、桌面安装及开发流程验证 |
| `release/` | 分发清单与敏感文件检查 |
| `preview/` | 独立 React 预览与桌面宿主冒烟验证 |

常用入口保持为 `npm run build`、`npm test`、`npm run dev:dsh`、`npm run check:all` 和 `npm run check:release`。生产构建先检查类型，再清理 `dist/src`、`dist/tests` 中编译器拥有的文件，防止已删除源码的旧产物继续发布。

`public/client.js` 是构建产物。`public/app.js`、`index.html` 和 `style.css` 仍是旧独立管理页面，其后续统一属于管理界面功能的工作。
