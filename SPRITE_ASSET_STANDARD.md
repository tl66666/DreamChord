# DreamChord 立绘交付规范（最终版）

## 先说清楚：白底、透明、格子分别是什么

- **生成阶段：白底。**
  AI 生成角色立绘时，请使用 `flat white studio background` / `plain solid white background`。白底只是为了后续抠图，不是最终进游戏的背景。

- **项目使用阶段：透明 PNG。**
  放进 `apps/web/public/assets/characters/` 的角色立绘，应该是已经抠掉白底的透明 PNG。游戏里会把透明角色叠到教室、樱花街、咖啡馆等背景上。

- **你看到的灰白格子不是背景。**
  灰白棋盘格是图片查看器/设计软件用来表示“这里是透明”的预览方式。它不会在游戏里显示，也不应该被 AI 画进图片里。

## 禁止事项

不要在 AI prompt 里写：

```text
transparent background, checkerboard, alpha channel, no background
```

这些词很容易让 AI 直接画出假的格子背景。正确做法是先白底生成，再用抠图工具得到真正透明 PNG。

## 立绘处理边界

为了保护你已经生成好的角色图，后续配置素材时遵守这几条：

1. 不修改人物五官、身体比例、衣服结构和姿势。
2. 不用脚本强行提高/降低整个人物透明度。
3. 不为了修鼻尖、边缘或亮度去批量改像素。
4. 如需修图，优先重新生成或用 PS 局部手工修，不在项目配置阶段自动加工角色本体。
5. 代码层只负责引用、定位、缩放和显示，不负责重绘角色。

## 正确文件流

```text
AI 生成白底 VN standing sprite
  -> 人工确认人物没变形、比例正确、全身完整
  -> 抠图得到透明 PNG
  -> 放入 apps/web/public/assets/characters/
  -> 项目代码只读取这个 PNG，不再二次改图
```

## 统一立绘 Prompt 核心

```text
DreamChord visual novel sprite, anime character standing sprite, centered composition, full body, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no portrait photography style, no photography style, no depth environment
```

## Negative Prompt

```text
different art style, realistic rendering, oil painting, watercolor, 3D, chibi, childish style, thick brush strokes, inconsistent face, different outfit, extra fingers, bad hands, text, watermark, logo, checkerboard pattern, grid pattern, transparent background, scene background, illustration background scene, portrait photography style, photography style, depth environment, cropped body, multiple characters
```

## 当前项目角色文件

这些文件应保持为透明 PNG，且不再由配置脚本二次改图：

- `yuki_normal.png` / `yuki_smile.png` / `yuki_surprised.png`
- `ren_normal.png` / `ren_smirk.png` / `ren_serious.png`
- `miya_normal.png` / `miya_smile.png` / `miya_warm.png`
- `sora_normal.png` / `sora_curious.png` / `sora_happy.png`
- `system-ghost.png`

头像文件 `*_avatar.png` 用于 UI 头像，不作为剧情舞台全身立绘处理。
