# 发布与插件搜索收录

核对日期：2026-10-30。当前为本地测试版；本文是发布步骤，不表示已经完成 npm 发布或社区收录。

## 安装与搜索是两个环节

DSH 的「添加插件」支持包名、Git 地址、本地目录和 tarball。可获取、符合规范的插件可以按地址安装。「发现」则读取用户配置的索引，官方当前实现不预设索引源；发布到 npm 不会自动出现在所有用户的搜索中。依据：[官方插件市场说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-market/README.md)。

## 推荐发布顺序

1. **公开 GitHub 仓库。** 本地 remote 指向 `Morgiana-V3/dsh-feed-the-seek`；发布时确认已公开并推送准备发布的内容。补齐描述、截图和许可证，添加 topic `dsh-plugin`。npm keywords 不会自动创建 GitHub topic。
2. **发布 npm 包。** 保留包名 `dsh-feed-the-seek` 和中文展示名「大肥鱼饲养手册」。确定许可证后移除清单的 `private: true`，使用有权限的账号发布。
3. **提交社区索引。** 按 [dsh-plugin.org 提交说明](https://dsh-plugin.org/zh/submit)提交仓库、包名、安装命令、分类与兼容范围。该第三方社区要求公开仓库、根目录 `package.json`、`dsh-plugin` topic 和安装说明；其一键安装目录要求 npm 包。收录不是即时保证，也不是官方认证。
4. **验证搜索与安装。** 向索引运营方取得实际索引地址，在 DSH「发现 → 管理索引源」添加并刷新，搜索包名、中文名与「记忆」，再在干净 profile 安装验证。社区网页 URL 不等于索引 API URL。

也可以自行托管符合 [DSH 索引格式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/plugin-market-index/README.md)的 JSON 索引，让使用者添加。

## 当前测试版的发布命令

### GitHub 仓库链接安装

仓库安装和 npm 安装是独立渠道。若要让用户直接安装 GitHub 链接，每次提交前执行 `npm run build`，并把 `dist/src/**/*.js`、`dist/src/**/*.d.ts` 和 `public/client.js` 与源码一起提交。`.gitignore` 只放行这些运行产物，继续忽略测试构建文件与 source map。

根清单的 `main` 为 `dist/src/dsh.js`。本机 DSH 所带 pnpm 在存在 `prepack` 而入口缺失时，会尝试准备 Git 依赖，未授权就报 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`。提交构建产物后，安装使用已构建入口，无需放开全局脚本权限。不同 pnpm 版本仍需复测；发布的 npm 包或预构建 tarball 是更明确的分发方式。

已发布提交不会因本地修改自动更新。修复必须提交并推送后，仓库链接才会指向新内容；旧提交 `5bd6da8` 仍缺少构建产物。等待推送期间，可以在 DSH「添加插件」里填写本地 `npm pack` 产出的 `.tgz` 绝对路径。

### npm 发布

下列命令只在已决定公开发布、许可证确定、包名权限确认且已移除 `private: true` 后执行：

```sh
npm ci
npm test
npm run check:release
npm pack
npm login
npm publish --access public --tag beta
```

发布后可按标签安装：

```sh
dsh plugin --profile web add dsh-feed-the-seek@beta
```

这是 CLI 的 `web` profile 示例。桌面应用应在自身的「添加插件」中输入 `dsh-feed-the-seek@beta`，避免装到另一个 profile。

`beta` 用于预发布版本；向社区提交时写明完整版本与安装命令，并确认其是否收录 beta。仅发布 beta 不能保证只读取 latest 的扫描器能够发现。稳定版验证完成后再使用新的稳定版本号发布到 latest，才采用不带标签的安装命令。

npm 不允许复用已发布的同名版本；再次发布前需递增版本。参考 [npm publish 文档](https://docs.npmjs.com/cli/v11/commands/npm-publish/)。

## 本项目上架前还需确认

- 选择代码许可证，分别说明角色素材和 Zpix 字体的使用条件。
- 确认 npm 包名、账号权限以及公开仓库与待发版本一致。
- 在干净 DSH profile 安装最终 tarball，记录实测 DSH 版本；不能把上游最新规范等同于本机支持范围。
- 保留单人使用、QQ 尚未联调、跨平台尚未验证的说明。
- 核对索引中的图标、中文标题、描述、类别、关键字与安装版本。

README 的主要内容使用普通 Markdown，因为 DSH 详情页会省略原始 HTML；GitHub 中的图标居中只是展示增强。[官方详情渲染说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-market/README.md)
