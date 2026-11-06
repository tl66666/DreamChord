# 《请让这幅画老去》作品运行配乐

2026-11-03选取本仓库已经存在的8首作者创作音乐，供本故事游戏BGM嵌入使用。没有下载新歌，没有制作或授予独立音乐素材库。文件逐字节复制，未重编码、裁切或更改响度。

可移植映射为同目录 `music-map.json`；完整发布署名与来源为 `apps/web/public/assets/audio/paint-book/music-credits.json`。游戏结束页可链接 `/assets/audio/paint-book/credits.html` 查看人能读的曲名、作者、来源、许可与加工说明；该署名页没有播放器或裸音频下载入口。

`docs/paint-book-music-audition.html` 是作品配乐编排与原作者试听入口，只链接原作者HTTPS曲目页，不在页面托管这8首完整音频，不依赖本地仓库路径或GitHub Pages根路径，也不另存一份音乐合集。

| id | 作者原名（副题另记） | 作品 portable URL |
|---|---|---|
| tam-atelier | 多夢/TAM — アトリエの日常 | `/assets/audio/paint-book/tam-atelier.ogg` |
| tam-ame | 多夢/TAM — やさしい雨 | `/assets/audio/paint-book/tam-ame.ogg` |
| maou-acoustic29 | 森田交一/魔王魂 — アコースティック29 | `/assets/audio/paint-book/maoudamashii-acoustic29.ogg` |
| maou-piano12 | 森田交一/魔王魂 — ピアノ12 | `/assets/audio/paint-book/maoudamashii-piano12.ogg` |
| maou-healing15 | 森田交一/魔王魂 — ヒーリング15（副题：水平線の使者） | `/assets/audio/paint-book/maoudamashii-healing15.ogg` |
| ds-chaolu | 藤村ほわん/龍的交響楽 — 朝露 | `/assets/audio/paint-book/dragonic-symphony-chaolu.ogg` |
| amacha-tanken | 甘茶/甘茶の音楽工房 — 夏休みの探検 | `/assets/audio/paint-book/amacha-tanken.ogg` |
| amacha-yume | 甘茶/甘茶の音楽工房 — 夢 | `/assets/audio/paint-book/amacha-yume.ogg` |

来源均为 `assets/music-packs/community-vn/runtime/` 的既有文件，其源MP3文件名、原MP3 SHA、本地源Ogg SHA、发布Ogg SHA、精确时长和原pack处理记录保留在作品credits中。原pack记录为MP3双遍响度标准化约-18 LUFS/-1 dBTP/LRA=11后转换为Vorbis q5、44.1kHz；本次没有重新测量并承诺LUFS数值，仅验证字节、格式、时长、完整解码。

## 作品中的署名

- [TAM](https://www.tam-music.com/interface)：允许游戏BGM，商业使用需在作品中标 `音楽：TAM Music Factory`；本作另保留多夢/TAM、原名与[曲目页](https://www.tam-music.com/music/simple)。禁止素材本身二次配布。
- [魔王魂](https://maou.audio/rule/)：当前页面同时提供CC BY 4.0与自站条款选择，当前自站条款也要求著作表记。本作品3首明确选择 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 路径，完整记载 `音楽：魔王魂（作曲：森田交一）`、原名、作者来源页、许可链接与源pack改动说明。不将这一选择扩大为所有既有素材的任意再分发承诺。
- [龍的交響楽](https://d-symphony.com/)：允许营利/非营利作品BGM；必须表记龍的交響楽或来源URL。保留藤村ほわん与[中華曲目页](https://d-symphony.com/mt_10.html)，《朝露》作者说明为略带中华风的钢琴独奏。禁止音频单独或合集二次分发。
- [甘茶の音楽工房](https://amachamusic.chagasi.com/terms.html)：允许个人/商业游戏BGM与音频加工，禁止音乐本身单独出售或二次分发；本作即使并非强制也保留 `音楽：甘茶の音楽工房（作曲：甘茶）` 与逐曲来源链接。

本次只最小修正旧社区manifest中8首魔王魂的“署名任意”为“须署名”，以及旧来源说明中将作品BGM允许误扩为通用曲库可再分发的表述。不改原音频、通用曲库逻辑或数据库。

## 检查与试听边界

`node scripts/package-paint-book-music.mjs` 可从仓库现有源文件重建这8个作品文件、credits JSON、人能读的署名页、映射与作者试听入口页；脚本无网络请求，复制前检查源SHA，复制后完整解码。`node --test scripts/paint-book-music.test.mjs` 检查8曲集合、字节一致、时长、44.1kHz双声道Vorbis、逐首完整解码、来源与署名、原作者试听链接、公开页面没有播放器或裸音频链接，以及旧许可文案的限定范围。

选曲依据作者介绍与元数据，**未完成人耳试听**。所有文件虽然可重复播放，但未验证无缝循环，不能把 `loop:true` 理解为已处理循环接缝。疑点首次出现、人物拒绝与实物核对前停乐，未解决的冲突前不以配乐提前宣布和解。最终对白遮挡、音色和循环接缝请由实际听者确认。
