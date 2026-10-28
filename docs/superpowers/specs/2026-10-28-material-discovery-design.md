# 素材发现、试听与角色分配

用户授权自主设计，并指出录音棚大横幅、命名分类与素材分配路径不清晰。本轮以“找到素材 → 预览/试听 → 分配到故事 → 编辑器继续使用”为完整验收路径。

## 选择

采用浅色素材工作台：白色内容面、细边框、墨色正文、紫色操作。去掉深色录音棚横幅、重复标题和重复创建按钮，采用连续的米白与浅紫底色、清晰的大幅透明插画，避免独立图片底板。保留首页幻想题材气质；主内容首先展示素材和可执行操作。

音色按可听见的特征命名，示例角色作为推荐使用信息，不混在音色主标题里。预设名称仅在仍是旧默认名称时升级，用户自定义名称保留。分类包括推荐/自建、声线、适用人物与样音语言，语言显示中文名称。

音色卡直接提供试听、用途、可用语言、现有角色分配和“分配给角色”。分配弹层选择故事与角色，明确现有绑定，保存后进入编辑器。技术参数、样本管理与单句试制放在主动打开的详情中。编辑器内更换音色也能先试听、比较，无需离开项目。

背景按场所、时间、氛围分类，保留稳定素材 ID；标题描述画面，不使用系统内部术语。预览大图展示用途；“用于故事”携带选中背景进入编辑器，再选择场景应用，图谱节点与分支连线保持完整，可撤销。

音乐与音效沿用同一轻量标题、筛选和试听层级。库导航明确视觉、音频和文件管理分组，通过 URL 保留分类与来源故事上下文。

## 边界与验证

不改写剧情，不重新训练/生成全部声音，不重置用户素材或角色绑定。针对分类兼容、试听语言、角色分配和背景应用图谱边界做行为测试。实际检查桌面与手机，验证配图清晰度、滚动、焦点、空结果、保存失败、已有绑定反馈以及跨页面上下文。
# All-page visual refinement

The user clarified that beautiful pictures alone are insufficient: small art and independent image tiles look pasted onto mismatched backgrounds. Use a shared continuous ivory/lilac introduction surface, larger transparent collection art and feathered landscape edges. Remove nested image backplates. Apply the same navigation, spacing and text hierarchy to Home, Explore, Settings and the library; keep auth and Agent empty states quiet and integrated. Editor/player stages use actual scene backgrounds rather than unrelated decorative objects.

Mobile checks must include all six catalog categories, scrollable dialogs with reachable actions, persistent audio controls and no page-level horizontal overflow. Voice catalog loading must not depend on a slow or unavailable inference engine.

Reference review: Nuwa's supplied screenshots inform audition/filter/assignment discovery; [Nuwa documentation](https://docs.nuwaai.com/) describes voice cloning and integrated SDK/protocol workflows. [WebGAL documentation](https://docs.openwebgal.com/) separates backgrounds, figures, audio and scene/branch authoring. [Paper2Gal](https://paper2gal.com/) emphasizes readable scenes and character selection. These are workflow references; no proprietary interface art or character assets were copied.

