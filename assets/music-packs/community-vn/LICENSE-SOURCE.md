# 社区原声集：来源与授权

- 打包方式：聚合四个允许商用、可自托管分发的日本素材站曲目，与 OtoLogic 的 CC BY 4.0 音效，全部为真人演奏/制作，未使用生成式 AI。
- 本项目处理：逐首双遍响度标准化（EBU R128 loudnorm，I=-18 / TP=-1 / LRA=11）后转为 Ogg Vorbis q5（44.1kHz）；音效与人声样本不做响度目标处理，仅转码。未改变作品权属。
- 逐曲作者、许可、来源 URL、原始文件名与 SHA-256 见同目录 `manifest.json`；每个条目均可在对应来源页复核。

## 曲目来源与署名要求

| 来源 | 曲目 | 许可要点 | 署名要求 |
|---|---|---|---|
| [甘茶の音楽工房](https://amachamusic.chagasi.com/)（甘茶） | 6 首（緩やかな風 / 平安ノ宵 / 夢 / 夏の霧 / 夜半ノ月～夜道 / 夏休みの探検） | 可商用；修改可；禁止单独售卖素材或再配布素材本身 | 非强制，DreamChord 统一保留『甘茶の音楽工房』署名与链接 |
| [TAM Music Factory](https://www.tam-music.com/)（TAM） | 5 首（琴ノ音 / 栄華の墓所 / やさしい雨 / はらりはらりに手をとられ… / アトリエの日常） | 可商用；禁止素材本身的再配布 | **商用必须表示出处**『音楽：TAM Music Factory』 |
| [魔王魂](https://maou.audio/)（森田交一） | 8 首（揺れる提灯 / いつかの秋空 / 宿命のシナリオ / The Milky Way piano ver. / ヒーリング15 / ファンタジー15 / ピアノ12 / アコースティック29） | 商用 OK、改変 OK | 署名任意，DreamChord 统一保留『魔王魂 森田交一』 |
| [龍的交響楽](http://d-symphony.com/)（藤村ほわん） | 4 首（朝露 / 燈火 / 四彩躍動 / 白虎豪勇） | 营利可 | **必须表记**『龍的交響楽』或来源 URL |

> 使用本包发布作品时，请按上表保留对应署名（尤其是 TAM 与龍的交響楽的强制表记）。各站均禁止把素材文件单独再分发为"素材包"：本包仅作为 DreamChord 应用内置曲库随应用分发，不得单独拆包传播。

## 音效来源

- 全部音效（含 `demoSfx` 5 个官方 Demo 音效）来自 [OtoLogic](https://otologic.jp/)，许可为 **CC BY 4.0**，署名『OtoLogic』即可，允许商用、改変与再分发。
- demo 音效随应用发布在 `apps/web/public/assets/audio/demo/`：`sfx-erase`（Roulette-Digital01）、`sfx-paper`（Book01）、`sfx-node`（PC-Mouse02）、`sfx-clock`（Clock-Second_Hand01）、`sfx-save`（Onoma-Ding01）。

## 调研中排除的来源（避免误用）

- 効果音ラボ：再配布禁止 → 不入库。
- あみたろの声素材工房：素材网站转载禁止 → 不入库。
- 耳聆网（中文音效/人声）：需登录才能下载，未能自动化获取授权文件 → 未收录。
- 中文真人语音：未找到许可干净且允许再分发的来源 → 暂未收录，见 `assets/voice-packs/dreamchord-human/LICENSE-SOURCE.md`。
