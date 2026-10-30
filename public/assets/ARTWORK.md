# 角色素材

本插件使用社区蓝色鲸鱼娘女仆人设的同人生成素材，不是官方美术，也不主张角色原型为本项目原创。

人设参考：[蓝色大肥鱼档案馆](https://fisharchive.cc/)、[DSH 大肥鱼](https://github.com/QCYTSN/dsh-dafeiyu)。角色原型「溟月」来自上善无形，DeepSeek 女仆服二次设计来自 ZipZipPipe；社区 Q 版形象参考「这个刀子真甜」。

- `plugin-icon-v5.png`：透明像素图标，女孩双手搭在蓝色饲养手册上。先用 image_gen 设计构图，经过 NovelAI 0.45 转绘，再用 image_gen 强化像素风并恢复透明通道。最终输出为 256×256 RGBA PNG。
- `portrait-calm.png`、`portrait-happy.png`、`portrait-discouraged.png`、`portrait-annoyed.png`：设置页的四种状态配图；采用 image_gen 设计和 NovelAI 风格转绘流程。
- NovelAI 风格提示包含 `artist:ahiru_tokotoko, year 2025, pixel art, limited color palette`。这是生成时的风格标签，不代表该画师创作、授权或认可了本插件。

发布目录仅包含实际使用的最终素材。生成凭据、原始试验参数、旧稿与个人生成记录不随插件分发。字体采用独立授权，参见 `fonts/ZPIX-UPSTREAM-README.md`。
