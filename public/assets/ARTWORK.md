# 角色素材

根目录 MIT 许可证仅适用于项目代码及相关技术文档，不适用于本目录的角色图片、图标或字体。角色原型及第三方素材的权利归相应权利人；本项目不以 MIT 授予这些素材的再分发、改编或商业使用权。需要单独使用素材时，应核实原型及相关素材的授权。字体遵循随附的上游说明。

本插件使用社区蓝色鲸鱼娘女仆人设的同人生成素材，不是官方美术，也不主张角色原型为本项目原创。

人设参考：[蓝色大肥鱼档案馆](https://fisharchive.cc/)、[DSH 大肥鱼](https://github.com/QCYTSN/dsh-dafeiyu)。角色原型「溟月」来自上善无形，DeepSeek 女仆服二次设计来自 ZipZipPipe；社区 Q 版形象参考「这个刀子真甜」。

- `plugin-icon-v6.png`：浅蓝圆角底的鲸鱼娘头像，托腮、略带得意的表情。用 image_gen 参考既有人设与图标构图生成，最终输出为 256×256 RGBA PNG，圆角外保留透明。此版图标未使用 NovelAI 转绘。
- `portrait-calm.png`、`portrait-happy.png`、`portrait-discouraged.png`、`portrait-annoyed.png`：设置页的四种状态配图；采用 image_gen 设计和 NovelAI 风格转绘流程。
- `portrait-concerned.png`、`portrait-shy.png`：担心和害羞姿态，分别采用攥围裙、回望并用尾鳍遮脸的动作。使用既有立绘作人设和像素风参考，由 image_gen 出稿，再经 NovelAI `nai-diffusion-4-5-full` 以 0.45 强度重绘。
- `portrait-hopeful.png`、`portrait-relieved.png`：期待和释然姿态，分别采用举拳打气、双手轻合并安心微笑的动作。由 image_gen 原稿经 NovelAI `nai-diffusion-4-5-full` 以 0.4 强度重绘，提示词引导为 4、噪声为 0。全部立绘显示尺寸为 296×364，八种当前情绪各有对应立绘，旧状态 `steady` 沿用平静配图。
- 状态配图的 NovelAI 风格提示包含 `artist:ahiru_tokotoko, year 2025, pixel art, limited color palette`。这是生成时的风格标签，不代表该画师创作、授权或认可了本插件。

字体采用独立授权，参见 `fonts/ZPIX-UPSTREAM-README.md`。
