# 发布与插件搜索收录

正式版通过 npm 和 GitHub Release 分发。代码与技术文档采用 [MIT](../LICENSE)，图片、图标和字体遵循[素材说明](../public/assets/ARTWORK.md)。

## 安装

在 DSH「添加插件」中输入 `dsh-feed-the-seek@1.0.0`，或从 [GitHub Release](https://github.com/Morgiana-V3/dsh-feed-the-seek/releases/tag/v1.0.0) 下载 `.tgz` 并填写本地绝对路径。安装后完全退出并重启 DSH。

CLI 用户可按实际 profile 安装：

```sh
dsh plugin --profile web add dsh-feed-the-seek@1.0.0
```

`web` 是 CLI 示例，不代表桌面应用的 profile。桌面用户优先使用应用内的「添加插件」。

## 维护者发布流程

1. 更新 `package.json`、锁文件、README 与安装示例中的版本号。
2. 运行测试和静态检查，构建分发包。
3. 在独立环境安装该包，验证宿主加载、设置页、记忆读写及升级后的数据保留。
4. 提交源码与 `dist/src`、`public/client.js` 预构建文件，推送提交并创建版本标签。
5. 将经过验证的同一份 `.tgz` 发布到 npm，并附在对应的 GitHub Release 中，同时提供 SHA-256 校验文件。

```sh
npm ci
npm test
npm run check:all
npm pack
npm publish ./dsh-feed-the-seek-1.0.0.tgz --access public --tag latest
```

发布需要已登录且有包权限的 npm 账号，账号还可能要求额外身份验证。正式版使用 `latest`；预发布版本使用单独的版本号和 `beta` 标签。npm 不允许重复发布同名同版本，见 [npm publish 文档](https://docs.npmjs.com/cli/v11/commands/npm-publish/)。

Git 地址安装依赖仓库中的预构建文件；安装端不应依赖执行本项目的构建脚本。修改代码后必须将构建产物与源码同步提交。预构建 tarball 可用于固定分发内容。

## 分发检查与支持范围

`npm run check:release` 在 Git 可用时同时检查 Git 候选文件和 npm 文件清单：排除数据库、日志、凭据、个人路径、旧编译产物、制作工作流及未列入清单的图片，并检查 PNG 文本/EXIF、WebP EXIF/XMP 元数据。没有可用 Git 仓库时仅核验 npm 包，并明确报告 `gitCandidatesChecked: false`，不代表 Git 发布清单已经通过检查。测试和开发脚本保留在源码仓库，不进入安装包。数据扫描不能代替对导出记忆正文的人工审查。

图片制作工作流、模型路径配置、中间帧、对照预览、执行记录与临时数据应存放在项目目录之外。源码中的 `public/assets` 只保留运行所需的最终素材、静态回退图及来源说明。`workflows/`、`outputs/`、`.feed-the-seek/` 和 Python 缓存均不提交；发布包由 `package.json` 的 `files` 白名单限定。

支持范围为 **Windows、单人本地使用**。已验证 DSH 0.2.1-rc.5 的内核集成；QQ 具体插件联调、多人身份隔离和跨平台安装仍需进一步验证。发布说明应列出实际完成的检查，不能把宿主集成测试等同于完整桌面界面验收。

## 搜索收录

按地址安装和搜索收录是两个环节。DSH 的「发现」读取用户配置的索引，npm 发布不会自动使插件出现在所有用户的搜索中，见[官方插件市场说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-market/README.md)。

如需申请第三方社区收录，可按 [dsh-plugin.org 提交说明](https://dsh-plugin.org/zh/submit)提供公开仓库、包名、安装命令、分类与兼容范围，并设置 `dsh-plugin` topic。社区收录不等于官方认证。

也可以托管符合 [DSH 索引格式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/util/plugin-market-index/README.md)的 JSON 索引。网页地址不等于索引 API 地址，需在 DSH「发现 → 管理索引源」中添加实际索引地址并验证。
