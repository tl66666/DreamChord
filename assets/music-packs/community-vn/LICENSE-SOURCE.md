# 社区原声集：来源与授权

- 本地来源记录：聚合四个允许将音乐用于商业或非商业作品BGM的日本作者站曲目，与 OtoLogic 的 CC BY 4.0 音效。音乐为作者创作/制作，可能使用MIDI与虚拟音源，不代表每首都是现场演奏实录；本清单声明未使用生成式 AI。
- 本项目处理：逐首双遍响度标准化（EBU R128 loudnorm，I=-18 / TP=-1 / LRA=11）后转为 Ogg Vorbis q5（44.1kHz）；音效与人声样本不做响度目标处理，仅转码。未改变作品权属。
- 逐曲作者、许可、来源 URL、原始文件名与 SHA-256 见同目录 `manifest.json`；每个条目均可在对应来源页复核。

## 曲目来源与署名要求

| 来源 | 曲目 | 许可要点 | 署名要求 |
|---|---|---|---|
| [甘茶の音楽工房](https://amachamusic.chagasi.com/)（甘茶） | 6 首（緩やかな風 / 平安ノ宵 / 夢 / 夏の霧 / 夜半ノ月～夜道 / 夏休みの探検） | 可商用；修改可；禁止单独售卖素材或再配布素材本身 | 非强制，DreamChord 统一保留『甘茶の音楽工房』署名与链接 |
| [TAM Music Factory](https://www.tam-music.com/)（TAM） | 5 首（琴ノ音 / 栄華の墓所 / やさしい雨 / はらりはらりに手をとられ… / アトリエの日常） | 可商用；禁止素材本身的再配布 | **商用必须表示出处**『音楽：TAM Music Factory』 |
| [魔王魂](https://maou.audio/)（森田交一） | 8 首（揺れる提灯 / いつかの秋空 / 宿命のシナリオ / The Milky Way piano ver. / ヒーリング15 / ファンタジー15 / ピアノ12 / アコースティック29） | 商用 OK、改変 OK；[现行条款](https://maou.audio/rule/)提供 CC BY 4.0 与自站条款的可选路径 | 须署名『音楽：魔王魂』；DreamChord 同时保留森田交一与来源链接 |
| [龍的交響楽](http://d-symphony.com/)（藤村ほわん） | 4 首（朝露 / 燈火 / 四彩躍動 / 白虎豪勇） | 营利可 | **必须表记**『龍的交響楽』或来源 URL |

> 将选中曲目嵌入游戏或其他作品作为BGM时，请保留对应署名、来源、许可及加工说明。作者允许作品BGM不等于允许将音乐本身作为独立音乐素材库再分发；本记录不授予或确认通用应用内置曲库的再分发权，也不允许拆包传播。2026-11-03作品选曲仅复制已核验的8首用于《请让这幅画老去》，其魔王魂3首明确选择CC BY 4.0路径并保留作者、来源、许可链接及源pack加工记录；见 `apps/web/public/assets/audio/paint-book/music-credits.json`。未重写其余作者的许可范围。

## 音效来源

- 全部音效（含 `demoSfx` 5 个官方 Demo 音效）来自 [OtoLogic](https://otologic.jp/)，许可为 **CC BY 4.0**，署名『OtoLogic』即可，允许商用、改変与再分发。
- demo 音效随应用发布在 `apps/web/public/assets/audio/demo/`：`sfx-erase`（Roulette-Digital01）、`sfx-paper`（Book01）、`sfx-node`（PC-Mouse02）、`sfx-clock`（Clock-Second_Hand01）、`sfx-save`（Onoma-Ding01）。

## 调研中排除的来源（避免误用）

- 効果音ラボ：再配布禁止 → 不入库。
- あみたろの声素材工房：素材网站转载禁止 → 不入库。
- 耳聆网（中文音效/人声）：需登录才能下载，未能自动化获取授权文件 → 未收录。
- 中文真人语音：未找到许可干净且允许再分发的来源 → 暂未收录，见 `assets/voice-packs/dreamchord-human/LICENSE-SOURCE.md`。
