# DreamChord 场景编辑器设计说明

日期：2026-07-02（rev 3）

## 目标

编辑器面向不懂节点图的创作者。用户应该像写视觉小说一样工作：

```text
项目 → 章节 → 场景 → 镜头卡 → 自动生成节点
```

节点图仍然存在，但它是"检查分支结构"的辅助视图，不是主编辑入口。

## 主界面

当前主编辑器是 `apps/web/src/editor/FlowEditor.tsx`。

三栏布局：

- 左栏（w-56）：`SceneTree.tsx`，管理章节和场景。
- 中栏（flex-1）：`ShotCardEditor.tsx`，编辑当前场景里的镜头卡。
- 右栏（w-80）：默认显示 `MiniPreview.tsx`（预览），可切换为 `AssetPanel.tsx`（素材库）或 `AIAssistantPanel.tsx`（AI 助手）。

右栏不是浮动层，而是替换式面板——打开素材库或 AI 助手时，MiniPreview 被替换，关闭后恢复预览。

顶部工具：

- 章节切换（中文数字：第一章、第二章...）
- 新章节 / 删除章节
- 场景编辑 / 剧情流程图
- 项目设置
- 项目体检
- 发布 / 分享
- 素材库
- AI 助手
- 预览
- 保存

## 状态管理

编辑器使用 Zustand（`useEditorStore`）作为**单一数据源**：

- `store.nodes` / `store.edges` 直接被 FlowEditor 读取
- 所有更新通过 `store.setNodes()` / `store.setEdges()` 统一操作
- 异步函数中使用 `useEditorStore.getState()` 读取最新状态
- 已移除 `useNodesState` / `useEdgesState` 本地副本，消除双状态源竞态

```
用户编辑卡片 → ShotCardEditor.onUpdateGraph(nodes, edges)
                              ↓
                    FlowEditor.handleUpdateGraph()
                              ↓
                    store.setNodes() + store.setEdges()
                              ↓
                    triggerAutoSave()（防抖）
```

## 场景

场景是同一组 `sceneGroupId` 节点的集合。

场景关键字段：

```ts
sceneGroupId: string
sceneCode: string       // 例如 1-1, 1-2, 2-1
sceneTitle?: string     // 用户自定义场景名
```

场景起始节点检测：必须使用 `findSceneStartNode(sceneGroupId, nodes, edges)`，通过"没有来自同场景入边的节点"定位。不要用 `nodes.find()` 按数组顺序查找——文本节点可能排在背景节点前面，导致误判。

左侧场景树支持：

- 新建章节
- 新建场景
- 选择场景
- 重命名场景
- 删除场景
- 按章节折叠长剧情

新建场景时自动携带前一场景的角色退场（hide 动作），并生成"——场景切换，角色退场——"旁白卡。新场景背景默认为空，显示"请选择背景"占位符。

## 镜头卡

镜头卡是用户真正编辑的最小创作单元。

一张镜头卡可以包含：

- 背景
- 多个登场角色
- 角色立绘状态（表情）
- 角色站位（左/中/右）
- 说话人
- 旁白 / 对话 / 心理 / 回忆 / 系统提示
- 选项及其分支去向

镜头类型：

```ts
type LensType = 'dialogue' | 'narration' | 'thought' | 'memory' | 'system'
```

| 类型 | 用途 | 编译为节点 |
|---|---|---|
| dialogue | 角色对话 | dialogue 节点 |
| narration | 旁白文字 | subtitle 节点 |
| thought | 心理描写 | dialogue 节点（role 保持角色） |
| memory | 回忆镜头 | subtitle 节点 |
| system | 系统提示 | subtitle 节点（role=ghost） |
| choice | 选项分支 | choice 节点（带 choice-N 出边） |

普通镜头卡编译为：

```text
background node → character node(s) → dialogue/subtitle node
```

选项镜头卡编译为：

```text
background node → character node(s) → choice node
```

### 卡片插入机制

当 `addCard` 或 `quickAppendDialogue` 向已有出边的场景添加新卡片时，采用**插入模式**：

1. 找到场景尾节点的出边
2. 断开旧出边
3. 连接 `尾节点 → 新节点[0]`
4. 连接 `新节点[末尾] → 旧目标`

这防止了新节点成为孤立节点（DFS 无法到达，导致播放器中不显示）。

### 共享背景处理

当多张卡片共享同一个 bg 节点时：
- 仅修改背景：创建新 bg 节点，不改共享节点
- 完整重建：找到入边 → 断开 → 重建链（不含 bg）→ 重新连接入边

## 分支设计

选择不一定都要马上汇合。

支持三种真实写法：

- 选项 A 创建 A 分支场景，继续沿 A 往下写。
- 选项 B 创建 B 分支场景，继续沿 B 往下写。
- A/B 分支发展一段后，都跳到同一个汇合场景。

### 选项去向管理

每个选项可以有以下状态：

| 状态 | 视觉表现 | 操作 |
|---|---|---|
| 未设置去向 | 琥珀色"未设置去向"警告 + 汇总提示条 | "写这条分支"（新建场景）或"跳转到已有场景"（下拉选择） |
| 已设置去向 | 绿色目标场景标签 + 汇合点紫色徽章 | "前往编辑"、"断开" |
| 目标为汇合场景 | 绿色标签 + 紫色"汇合点"徽章 | 同上 |

折叠视图中，无去向的选项也显示琥珀色"未设置"标识，卡片头部显示未设置数量徽章。

### 运行时回退

当播放器执行 `choose(index)` 但目标未设置或无效时，回退到下一场景（`moveToScene(sceneIndex + 1)`），而非直接结束故事。

### 编辑建议

1. 在选项卡里先写清楚选项文本。
2. 对每个选项使用"写这条分支"创建独立后续场景。
3. 如果需要汇合，再把多个分支跳转到同一场景。
4. 切到"剧情流程图"只检查连线，不在里面主写剧情。

## 剧情流程图

`StoryFlowchart.tsx` 提供 galgame 风格的全局流程图：

- 按章节分行排列场景卡片
- 普通连接：实线箭头
- 选项分支：虚线箭头并标注选项文本
- 汇合场景：紫色高亮 + GitMerge 图标徽章
- 选项节点：粉色边框 + 分支数量徽章
- 支持缩放（滚轮）、拖拽平移、点击跳转编辑
- 支持拖拽场景卡片调整位置
- 支持拖拽创建场景间连接

汇合场景通过 `findConvergenceScenes(nodes, edges)` 检测——接收多条来自不同场景入边的场景即为汇合点。

## 长剧情管理

不要把长篇剧情写成一个无限向下的列表。

推荐层级：

- 第一章：开端、日常、第一次冲突
- 第二章：调查、反转、分支扩大
- 第三章：真相、收束、结局

每章内部再拆为 `1-1`、`1-2`、`1-3` 这样的场景。播放预览会按章节顺序合并播放。

章节编号使用中文数字（`toChineseNumber`）：一、二、...十、十一、...二十、二十一。`normalizeChapterTitle` 会自动将旧版阿拉伯数字标题转换为中文数字。

## 长文导入

点击"导入长文"按钮，粘贴小说正文：

- `角色：台词` 识别为角色对话
- 普通段落识别为旁白
- 包含"回忆、想起、曾经"等词标记为回忆镜头
- 包含"心想、心里、暗想"等词标记为心理描写
- 包含"系统、提示、警告"等词标记为系统提示
- 超长段落按中文标点拆成多张镜头卡

## AI 助手

点击右上角"AI助手"按钮，右栏切换为 AI 面板：

- 显示当前选中卡片信息
- 五种模式：润色当前、续写剧情、生成选项、分支回应、生成节点图
- 空文本时显示提示
- 未配置 AI 时使用本地规则生成基础内容
- AI 供应商通过 `BaseOpenAICompatibleProvider` 统一接口，支持 GLM / DeepSeek / Kimi / OpenAI

## 项目体检

`FlowEditor.tsx` 内置 `ProjectHealthPanel`，检查 12 项：

1. 是否有节点
2. 是否使用场景 / 镜头卡结构
3. 无效连线
4. 多起点
5. 断开的选项出口
6. 空文本
7. 缺少背景
8. 缺少角色
9. 孤立节点
10. 不可达场景
11. 缺少结尾
12. 是否发布

## 用户反馈

使用 `FeedbackProvider` 提供的 `useToast()` 和 `useConfirm()`：

- `toast.success(msg)` / `toast.error(msg)` / `toast.info(msg)`：自动消失通知
- `const ok = await confirm(title, message)`：异步确认对话框

禁止使用原生 `alert()` / `confirm()`。

## 不再使用的旧组件

以下文件只作为旧实现参考，后续不要再围绕它们开发新功能：

- `WorkbenchPanel.tsx`
- `NodePalette.tsx`
- `PropertyPanel.tsx`

未来可以删除，但删除前应先确认没有任何 import。

## 验证

每次改编辑器后至少运行：

```powershell
cd C:\Users\唐乐\Desktop\实训2\项目\apps\web
npx tsc --noEmit
npx vite build

cd C:\Users\唐乐\Desktop\实训2\项目\apps\server
npx tsc --noEmit
```

浏览器检查：

1. 打开首页
2. 登录 `demo / demo123`
3. 进入编辑器
4. 新建或重命名场景
5. 添加对话、旁白、选项
6. 为每个选项创建或选择后续场景——确认琥珀色警告消失
7. 点击体检
8. 点击预览，确认选项出现、分支跳转正确
9. 切换到剧情流程图，确认连线和汇合点标记
