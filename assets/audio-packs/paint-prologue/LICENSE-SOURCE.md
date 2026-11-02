# 序章配乐与生活音效

2026-11-02核对来源页和许可。发布署名应保留 **Music: TERNOX / Sound effects: OtoLogic (CC BY 4.0)**，以及对应来源和修改说明。

- 配乐：[TERNOX原作者页](https://ternox.itch.io/vn-music)，[CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)。`afternoon.ogg`和`twilight.ogg`取自已有校验的`assets/music-packs/ternox-vn/runtime/`，分别发布为`workshop.ogg`和`afterglow.ogg`。保留原音频，不再次编码。
- 木质碰撞：[OtoLogic家具小物](https://otologic.jp/free/se/household-others01.html)的Sensu02-13，真实竹木骨架和纸折扇放到木面，作为轻碰木声的拟音素材；不是椅子倒地的现场录音。降调、短裁切和淡出等处理记录在`sfx-credits.json`。
- 掌声：[OtoLogic拍手01](https://otologic.jp/free/se/applause-cheer01.html)的Applause01-5，作者说明是单人手拍实录。以8层轻度错时、速度微调和声像处理表示小规模听众，避免使用标注100人或大场馆的群衆版；不是八名不同人的新录音，无欢呼。
- 翻纸：[OtoLogic Book01](https://otologic.jp/free/se/books01.html)，复用既有已校验`apps/web/public/assets/audio/demo/sfx-paper.ogg`。旧pack未保留Book01的具体变体编号，本轮不补造。

OtoLogic音效使用[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)；[作者条款](https://otologic.jp/free/license)允许商业使用与修改并要求署名。原始下载音频在`source/`保留，源文件与发布文件均记录SHA-256。所有音效只用于场景播放，未用作语音克隆参考或模型训练。

复现：`node scripts/package-paint-music-sfx.mjs`；验证：`node --test scripts/paint-music-sfx.test.mjs`。处理与检查使用ffmpeg/ffprobe；程序可检查解码、时长与哈希，不代表已完成人耳试听或表演审听。所有新credits的`humanListeningCompleted`当前为`false`。
