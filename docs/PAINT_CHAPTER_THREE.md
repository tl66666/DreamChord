# 《画外的夏天》制作与发布交接

2026-11-07，官方作品`dreamchord-paint-prologue`追加第三章，数据库order=3。原序章/第一章/第二章的数据、ID、版本与声音绑定保持不变；没有另建重复作品。

- [第三章中文阅读稿](story/paint/reading-chapter-three.zh.md)
- [第三章中日演出稿与节点编号](story/paint/03-chapter-three.md)
- [四章配乐节点表](story/paint/MUSIC-CUE-SHEET.md)
- [本轮编辑器与Agent修复](STUDIO_RELIABILITY_2026-11-07.md)
- 本地阅读：`http://127.0.0.1:5174/play/dreamchord-paint-prologue?chapter=3`

## 剧情与连续性

七场、84个图节点。30句短对白，40段双语旁白，旁白约3073汉字；长旁白仍在阅读层自然分框。资料顺序选择各有三个独有段落，再汇入同一段手记。

开场是夏禾试演结束：她带回练习意见，结果一周内回信，没有立刻录取或圆满恋爱。四月二十日三点的排练、六月六日第二班车、许野的空白明信片均继续有效。

画外的陆青核对纸套、照片背面、底稿与手记，整理日期不能等于拍摄/落笔日期。手记标明闻砚的第一人称；其中海边回忆另标前一年八月十七日。母亲有自己的脾气，会跑去买冰、忘帽子、嫌女儿走得太快。失去以后，闻砚还会做错招牌、煮多晚饭、找螺母、接下一件工作，未用格言或一顿饭解决悲伤。

蒙田《随笔》III.13的极短自译进入闻砚手记，她先觉得说得轻巧，后来仍须找尺子、留车钱。参考[公版法文原文](https://fr.wikisource.org/wiki/Page%3AMontaigne_-_Essais%2C_%C3%89d_de_Bordeaux%2C_3.djvu/299)，没有复用现代中文译文。

照片中的年轻母亲是人物原型的材料，并不能替夏禾填完生平。陆青分列“原作者选择未完成”与“画层损坏”，保留画层核验和委托材料的问题；她没有得到画内说话能力或整套超自然解释。手记没有提前预设程见新修的深色补木。闻砚与母亲的死亡均未被撤销，记录也不被设为免疫改写。

下一章《另一双手》继续陆青的委托、自己的创作位置与操作选择；不提前发布空白章节。

## 画面、声音与音乐

新增夏日工作室、雨后海边候车处、画外档案桌三张原创背景。内置生图生成，原生PNG、生产PNG、提示词与SHA位于`source-assets/paint-chapter-three/`，运行图为1920×1080 WebP，完整原生画面适配，无拼贴或源图裁切。手机竖屏背景沿用cover构图，正文保持可读，未承诺宽幅画面所有边缘物件同时可见。

30句日语对白共126.78秒，沿用程见、夏禾、许野的原参考与绑定。闻砚手记和陆青查证为无配音叙述；没有为历史人物临时套用另一角色声音。参考由Qwen3-TTS生成，正式对白仍为GPT-SoVITS v2ProPlus，没有训练角色专属权重。

完整解码、当前38条ASR覆盖（8参考＋30对白）与哈希已核对；旧三章195条运行对白及其母带与提交基线一致。6条定向重录保留旧母带/ASR，发音输入与字幕区分记录。**人耳听感和表演验收尚未完成**；“四月二十日、三時”仍有ASR字形/断词混淆，须复听，不以分数代替表演评价。详见`assets/voice-packs/paint-chapter-three/README.md`及`technical-review.json`。

音乐复用已署名的8首作品：工作室/生活用日常主题，旧夏与海边约定复现旋律，丧失与资料核对留出静默。没有加商业Galgame原声；完整作者、许可与加工说明继续由播放器结束页的音乐署名入口提供。

## 安装、发布与备份

全新环境先按主README安装依赖、迁移和demo账号，再安装序章、第一章及原两章→三章版本。已有三章直接执行：

```bash
pnpm demo:paint:chapter-three --check
# 备份后显式应用；不带参数也只预检
pnpm demo:paint:chapter-three --apply
pnpm test:paint
```

本次注册3→4版本，冻结旧三章在`assets/story-packs/paint-book/release-three-chapters-v1.json`。沿用整书指纹、demo归属、公开状态、原角色/参考校验、全部媒体预检和事务版本CAS；没有force开关。默认旧`demo:paint:release`仍是2→3命令，不在已有四章环境运行。

本地整库在线备份及原项目关系在忽略目录`.runtime/backups/paint-third-release-2026-11-07T06-47-00-321Z/`，含账号数据，不能上传。发布时原三章版本保持14/7/1，第三章为1；旧章节完整关系比对不变，其他作品和原声音参考不变，项目BGM仍10项（8现用＋2保留）。重复执行返回`current`。本轮独立QA故事随后已备份清理，现有作品总数为9。

原私人副本不自动接收官方新章，避免覆盖用户创作。后续若修改已发布四章，仍需冻结本版并增加明确的版本升级路径。

## 开发与验证

`node scripts/export-paint-chapter-three.mjs`导出中日稿和配音脚本；`node scripts/export-paint-chapter-two.mjs`同时更新四章配乐表。`node scripts/package-paint-chapter-three-art.mjs`从仓库生产PNG重建WebP，`--ingest`仅初次导入原生结果。

`pnpm test`672项、lint/build/readiness通过；`pnpm test:paint`18项，声音运行配置25项通过。四章16种选择组合、中文/日文短框文本保全、发布并发/私人改稿保护均有回归。独立叙事/发布审查未发现阻断问题。实机1440×900与390×844检查正文、新图和章节入口，两个分支可到章末。截图在`docs/screenshots/paint-chapter-three-*.webp`。

功能提交`4212368`的[GitHub CI](https://github.com/tl66666/DreamChord/actions/runs/42349219859)与[Pages部署](https://github.com/tl66666/DreamChord/actions/runs/42349219553)均通过；线上新增截图已验证加载、原比例与无横向溢出，原Hero保留。
