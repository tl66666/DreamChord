# 梦弦 DreamChord 素材生成指南

整体风格：梦幻、轻盈、节点连接成弦、pastel 紫蓝粉渐变、微光粒子、视觉小说立绘与二次元插画质感统一。

---

## ⚠️ 立绘白底与透明背景正确流程（必读）

> **AI 生成模型本身不会输出真正的透明 alpha 通道**，`transparent background` 这类提示词会让模型画出棋盘格/灰白格的"假透明"背景，无法直接使用。

> **白底不是透明底**。白底只用于后续抠图；最终放入项目的角色文件必须是抠图后的透明 PNG。生成时要锁定为「visual novel sprite / standing sprite」，避免模型误解成摄影棚人物照或普通插画角色图。

正确流程是**两步走**：

```
Step 1: AI 生成白底角色图（plain solid white background）
                ↓
Step 2: 用抠图工具去除白底，得到真正透明 PNG
                ↓
        放入 assets/characters/
```

### 禁止使用的提示词

以下词汇会让 AI 画出"假透明"或棋盘格背景，**一律禁止**：

- `transparent background`
- `checkerboard`
- `no background`（AI 会误解为画棋盘格）
- `alpha channel`

### 正确的立绘提示词模板

所有角色立绘统一使用以下背景描述：

```
DreamChord visual novel sprite, anime character standing sprite, centered composition, full body, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design
```

### 抠图工具推荐

| 工具 | 说明 |
|---|---|
| [remove.bg](https://www.remove.bg) | 在线一键抠图，适合少量素材 |
| Photoshop「选择主体」+「去除背景」 | 批量处理，精度最高 |
| Stable Diffusion Rembg 插件 | 生成同时自动抠图 |
| Python `rembg` 库 | 批量脚本处理 |

---

## 统一负面提示词（Negative Prompt）

**所有角色立绘生成时必须携带以下负面提示词**，防止风格漂移和背景污染：

```
Negative prompt: different art style, realistic rendering, oil painting, watercolor, 3D, chibi, childish style, thick brush strokes, inconsistent face, different outfit, extra fingers, bad hands, text, watermark, logo, checkerboard pattern, grid pattern, scene background, illustration background scene, portrait photography style, photography style, depth environment, cropped body, multiple characters
```

> 注意：负面提示词中已加入 `checkerboard pattern` 和 `grid pattern`，防止 AI 画出假透明网格背景。

---

## 统一 Prompt Layer（风格种子层）

为保证所有角色和视觉素材风格一致，生成时必须携带对应的「风格种子描述」作为 prompt 前缀。

### 现实层 · Human Layer

用于真实世界的人类角色：**雪、影、宫**。

```
DreamChord visual novel sprite, anime character standing sprite, centered composition, full body, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no portrait photography style, no photography style, no depth environment
```

> 核心锁定词：`visual novel sprite`、`anime character standing sprite`、`consistent VN character proportions`、`isolated character for sprite extraction`。这些词用于把模型锁定到 VN 立绘模式，而不是普通插画或摄影棚人物图。

### 系统层 · Chord Layer

用于系统、节点、UI 人格化存在：**空、系统幽灵、节点世界**。

```
DreamChord system layer, translucent glowing, UI particles, ethereal vector style, data-like light threads, soft vector anime, digital lifeform, pastel purple-blue-gold gradient, clean glowing edges, plain solid white background for cutout
```

### 背景层 · Background Layer

用于场景背景：教室、樱花街道、咖啡厅、星空。

```
DreamChord visual novel background, painterly anime background style, soft cinematic lighting, pastel purple-blue tone, gentle glow particles, 16:9 aspect ratio, shallow depth of field
```

> **生成原则**：同一层级的素材使用相同的风格种子，只在后面追加角色/场景具体描述。避免混用厚涂、赛璐璐、写实三种画风。

---

## 生成顺序（必须按此顺序执行）

为最大程度减少风格漂移，请严格按以下顺序生成：

1. **先重新生成 `yuki_normal.png` 标准版**：用新版 VN sprite prompt 验证人物比例、白底、线稿和整体画风
   - 只有 `yuki_normal.png` 达到标准后，再继续生成其他角色
   - 生成后立即用抠图工具去除白底
2. **再生成另外两张现实层 `normal` 立绘**：`ren_normal.png`、`miya_normal.png`
   - 三张确认风格一致后，再继续下一步
   - 每张生成后立即用抠图工具去除白底
3. **生成表情差分**：在 `normal` 基础上用相同 seed / 角色参考图生成各表情
   - 每张生成后立即抠图
4. **生成头像**：`*_avatar.png`，与立绘保持同一画风
5. **生成系统层角色**：`sora_*.png`、`system-ghost.png`
   - 系统层角色抠图后边缘可能有发光残留，可在 PS 中用「颜色范围」选取白色删除
6. **生成插画与品牌图**：背景、空状态插画、logo、hero、og-image
   - 这些图不需要抠图

---

## 存放路径总览（扁平结构，不要再改为多层目录）

```
apps/web/public/assets/
│
├── logo.png                          # App 图标
├── favicon.svg                       # 浏览器标签图标（SVG，填充背景无黑角）
├── hero.png                          # 首页 Hero 图
├── og-image.png                      # 社交媒体 / GitHub 预览图
│
├── backgrounds/                      # 场景背景
│   ├── bg-classroom.png
│   ├── bg-cafe.png
│   ├── bg-sakura.png
│   └── bg-starry.png
│
├── illustrations/                    # 空状态 / 引导插画
│   ├── empty-projects.png
│   └── empty-nodes.png
│
├── characters/                       # 角色立绘与头像（扁平结构，抠图后透明底）
│   ├── default-avatar.png            # 用户未设置头像时的默认头像
│   ├── system-ghost.png              # 系统幽灵角色立绘（独立于 default-avatar）
│   ├── yuki_avatar.png
│   ├── yuki_normal.png
│   ├── yuki_smile.png
│   ├── yuki_surprised.png
│   ├── ren_avatar.png
│   ├── ren_normal.png
│   ├── ren_smirk.png
│   ├── ren_serious.png
│   ├── miya_avatar.png
│   ├── miya_normal.png
│   ├── miya_smile.png
│   ├── miya_warm.png
│   ├── sora_avatar.png
│   ├── sora_normal.png
│   ├── sora_curious.png
│   └── sora_happy.png
│
└── covers/                           # 项目封面
    └── default-cover.png
```

> **重要**：`default-avatar.png` 是用户未设置头像时的默认头像；`system-ghost.png` 是系统幽灵角色。两者职责不同，不要混用。所有 `characters/` 下的立绘文件必须是抠图后的透明 PNG。

---

## UI 与品牌图

### 1. App 图标 `apps/web/public/assets/logo.png`

**推荐尺寸**：1024×1024

**提示词**：

```
DreamChord visual novel style, soft cinematic anime aesthetic, minimalist app icon. A glowing soft string or thread weaves through several floating translucent story nodes, forming a gentle sine wave. Background is a smooth pastel gradient from lavender to sky blue. Clean vector style, rounded corners, dreamy bokeh particles, ethereal lighting, no text, no letters, centered composition, 1024x1024.
```

### 2. 浏览器 Favicon `apps/web/public/assets/favicon.svg`

SVG 矢量图标，填充整个方形背景（无透明角），在浏览器标签上不出现黑边。

### 3. 首页 Hero 图 `apps/web/public/assets/hero.png`

**推荐尺寸**：1920×1080（16:9）

**提示词**：

```
DreamChord visual novel style, soft cinematic anime illustration, wide cinematic hero banner for a web-based visual novel editor called "DreamChord". A young writer silhouette sits at a floating desk in a dreamlike space, surrounded by glowing story nodes connected by luminous threads. In the background, open storybook pages transform into anime-style scenes and characters. Color palette: soft lavender, sky blue, blush pink, cream white. Magical particles, shallow depth of field, modern UI glassmorphism panels subtly overlaid, dreamy atmosphere, 16:9 aspect ratio, high detail illustration.
```

### 4. 社交预览图 `apps/web/public/assets/og-image.png`

**推荐尺寸**：1200×630

**提示词**：

```
DreamChord visual novel style, soft cinematic anime aesthetic, social media preview banner for "DreamChord" visual novel creation platform. Centered glowing logo composed of connected story nodes forming a chord/wave. Tagline space at bottom. Background: dreamy pastel gradient with floating storybook pages and anime-style scene fragments. Modern, clean, magical, 1200x630, no text.
```

> 此图用于 index.html 的 `og:image` / `twitter:image` meta 标签，在社交媒体分享和 GitHub 预览中展示。

---

## 封面与插画

### 5. 默认项目封面 `apps/web/public/assets/covers/default-cover.png`

**推荐尺寸**：1200×675（16:9）

**提示词**：

```
DreamChord visual novel style, soft cinematic anime illustration, soft dreamy book cover illustration for a default visual novel project. An ornate glowing book floating in mid-air, pages gently turning, with small light particles drifting out. Background is a blurred ethereal library with tall windows and soft sunset light. Pastel purple and blue tones, anime art style, mysterious and inviting mood, 16:9 aspect ratio.
```

### 6. 项目列表空状态 `apps/web/public/assets/illustrations/empty-projects.png`

**推荐尺寸**：1024×1024（1:1）

**提示词**：

```
DreamChord system layer, translucent glowing, UI particles, ethereal vector style, data-like light threads, soft vector anime, digital lifeform. A small friendly ghost-like creature made of soft glowing light holding a tiny blank storybook, looking curious. Floating around it are unused story nodes and a loose glowing thread. Pastel lavender and sky blue background, minimal clean vector anime style, whimsical and encouraging mood, 1:1 square.
```

### 7. 编辑器画布空状态 `apps/web/public/assets/illustrations/empty-nodes.png`

**推荐尺寸**：1920×1080（16:9）

**提示词**：

```
DreamChord system layer, translucent glowing, UI particles, ethereal vector style, data-like light threads, soft vector anime, digital lifeform. A floating glowing pencil drawing the first story node in a vast calm space. A single luminous thread extends from the node, waiting to connect. Soft pastel gradient from lavender to pale blue, minimalist dreamy vector anime style, clean composition, 16:9.
```

---

## 场景背景

生成背景时，统一追加背景层风格种子。背景图不需要抠图，直接使用即可。

### 8. 校园教室背景 `apps/web/public/assets/backgrounds/bg-classroom.png`

**推荐尺寸**：1920×1080（16:9）

**提示词**：

```
DreamChord visual novel background, painterly anime background style, soft cinematic lighting, pastel purple-blue tone, gentle glow particles, 16:9 aspect ratio, shallow depth of field. A peaceful Japanese high school classroom in late afternoon. Golden sunlight streaming through large windows, dust motes visible in light beams. Desks neatly arranged, blackboard with faint chalk marks, a few potted plants. Warm soft colors.
```

### 9. 星空背景 `apps/web/public/assets/backgrounds/bg-starry.png`

**推荐尺寸**：1920×1080（16:9）

**提示词**：

```
DreamChord visual novel background, painterly anime background style, soft cinematic lighting, pastel purple-blue tone, gentle glow particles, 16:9 aspect ratio, shallow depth of field. A vast starry night sky over a quiet hilltop. Thousands of stars and a bright Milky Way arc across deep indigo and purple sky. Soft grass silhouette in foreground, fireflies glowing. Dreamy, romantic, cinematic composition.
```

### 10. 樱花街道背景 `apps/web/public/assets/backgrounds/bg-sakura.png`

**推荐尺寸**：1920×1080（16:9）

**提示词**：

```
DreamChord visual novel background, painterly anime background style, soft cinematic lighting, pastel purple-blue tone, gentle glow particles, 16:9 aspect ratio, shallow depth of field. A peaceful street lined with cherry blossom trees in full bloom. Pink petals falling gently, traditional Japanese houses and modern shops mixed, soft spring sunlight. Dreamy pastel pink and white color palette.
```

### 11. 咖啡厅背景 `apps/web/public/assets/backgrounds/bg-cafe.png`

**推荐尺寸**：1920×1080（16:9）

**提示词**：

```
DreamChord visual novel background, painterly anime background style, soft cinematic lighting, pastel purple-blue tone, gentle glow particles, 16:9 aspect ratio, shallow depth of field. A cozy modern café interior. Warm ambient lighting, wooden tables, large windows showing rainy street outside, steam rising from a coffee cup on a table. Warm brown and cream tones, inviting atmosphere.
```

---

## 角色系统

角色设定详见 `CHARACTERS.md`。下面是角色头像与立绘的生成提示词。

所有现实层角色（雪、影、宫）立绘统一为 **1200×1800（2:3，白底生成 → 抠图后透明）**，头像统一为 **1024×1024（1:1）**。系统层角色（空、系统幽灵）尺寸相同，但强调半透明发光质感。

生成时务必将对应「风格种子」放在 prompt 最前面，保证统一画风。每张角色立绘必须携带 VN 立绘锁定提示词：`visual novel sprite, anime character standing sprite, full body, centered composition, flat white studio background, isolated character for sprite extraction, no environment, no illustration background scene, no portrait photography style`。

**生成后必须用抠图工具去除白底，才能放入 `assets/characters/` 使用。**

---

### 12. 默认用户头像 `apps/web/public/assets/characters/default-avatar.png`

**推荐尺寸**：1024×1024（1:1）

**用途**：用户未设置头像时显示的默认头像。不是系统幽灵。

**提示词**：

```
DreamChord system layer, translucent glowing, UI particles, ethereal vector style, data-like light threads, soft vector anime, digital lifeform. Default anonymous user avatar portrait. A gentle silhouette of a person facing forward, face softly obscured by a dreamy glow, wearing simple modern clothes. Surrounded by floating small story nodes connected by thin light threads. Plain solid white background, soft studio lighting, centered composition, isolated character for cutout. Mysterious but friendly, square 1:1 composition.
```

### 13. 系统幽灵立绘 `apps/web/public/assets/characters/system-ghost.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**用途**：系统幽灵角色的独立立绘，用于 Demo 剧情和引导流程。与 default-avatar 分开。

**提示词**：

```
DreamChord system layer visual novel sprite, anime character standing sprite, translucent glowing, UI particles, ethereal vector style, data-like light threads, soft vector anime, digital lifeform, pastel purple-blue-gold gradient, clean glowing edges, full body, centered composition, flat white studio background, isolated character for sprite extraction, no environment, no illustration background scene, no photography style. System Ghost, a small ghost-like creature made of soft glowing light. It has a pair of bright luminous eyes but no fixed face, and holds a tiny blank storybook in its arms. Floating story nodes and loose light threads orbit around it. Semi-transparent body with gentle pulsing glow, ethereal pastel tones, whimsical and friendly mood.
```

---

## 现实层角色 · Human Layer

以下角色统一使用现实层风格种子：

```
DreamChord visual novel sprite, anime character standing sprite, centered composition, full body, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no portrait photography style, no photography style, no depth environment
```

---

### 14. 雪头像 `apps/web/public/assets/characters/yuki_avatar.png`

**推荐尺寸**：1024×1024（1:1）

**提示词**：

```
DreamChord visual novel sprite, anime character portrait icon, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no illustration background scene, no portrait photography style. Yuki, a quiet 17-year-old high school girl and aspiring light novelist. Short black hair with slight inward curls, a small lavender hairpin on the left side. Soft lavender eyes, gentle but slightly distant gaze. Wearing a light blue sailor uniform with a lavender neck ribbon. Subtle glowing edge around her silhouette, suggesting she can see story threads. Centered portrait, friendly and introspective mood, square 1:1 composition.
```

### 15. 雪默认立绘 `apps/web/public/assets/characters/yuki_normal.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord visual novel sprite, anime character standing sprite, full body, centered composition, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no photography style. Yuki, 17-year-old high school girl, short black hair with slight inward curls, lavender hairpin on left side, soft lavender eyes, gentle thoughtful expression, light blue sailor uniform with lavender ribbon, holding notebook close to chest, reaching slightly toward unseen glowing node.
```

### 16. 雪微笑 `apps/web/public/assets/characters/yuki_smile.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord visual novel sprite, anime character standing sprite, full body, centered composition, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no photography style. Yuki, 17-year-old high school girl in light blue sailor uniform with lavender ribbon, short black hair with slight inward curls, lavender hairpin on left side, soft lavender eyes. She smiles softly, holding a notebook close. Warm and relieved expression, as if she finally wrote a good line.
```

### 17. 雪惊讶 `apps/web/public/assets/characters/yuki_surprised.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord visual novel sprite, anime character standing sprite, full body, centered composition, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no photography style. Yuki, 17-year-old high school girl in light blue sailor uniform with lavender ribbon, short black hair with slight inward curls, lavender hairpin on left side, lavender eyes wide open, mouth slightly open in surprise. One hand raised toward an unseen glowing story node. Shocked-but-curious expression.
```

---

### 18. 影头像 `apps/web/public/assets/characters/ren_avatar.png`

**推荐尺寸**：1024×1024（1:1）

**提示词**：

```
DreamChord visual novel sprite, anime character portrait icon, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no illustration background scene, no portrait photography style. Ren, a mysterious 17-year-old transfer student and remnant of a deleted world. Dark blue-black short hair with long bangs partly covering his left eye. Right eye is cool silver-gray with faint digital light patterns. Wearing a dark gray school uniform. Subtle glitchy line-break effects on shoulder and sleeve, like erased pixels. Calm, aloof expression, centered portrait, mysterious mood, square 1:1 composition.
```

### 19. 影默认立绘 `apps/web/public/assets/characters/ren_normal.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord visual novel sprite, anime character standing sprite, full body, centered composition, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no photography style. Ren, a 17-year-old mysterious transfer student and remnant of a deleted world. Dark blue-black hair, long bangs covering left eye, right silver-gray eye, dark gray school uniform. He stands with hands in pockets, turned slightly away, looking off-screen with a calm aloof expression. Faint digital glitch effects and disconnected line fragments around his shoulders.
```

### 20. 影微笑 `apps/web/public/assets/characters/ren_smirk.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord visual novel sprite, anime character standing sprite, full body, centered composition, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no photography style. Ren, mysterious transfer student with dark blue-black hair and silver-gray eye, dark gray uniform. He gives a subtle smirk, one eyebrow slightly raised, as if amused by something the protagonist wrote. Faint glowing story threads around him.
```

### 21. 影严肃 `apps/web/public/assets/characters/ren_serious.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord visual novel sprite, anime character standing sprite, full body, centered composition, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no photography style. Ren, mysterious transfer student with dark blue-black hair and silver-gray eye, dark gray uniform. Serious expression, eyes narrowed, posture straight. Digital glitch effects more visible around his body, emphasizing his nature as rewritten code.
```

---

### 22. 宫头像 `apps/web/public/assets/characters/miya_avatar.png`

**推荐尺寸**：1024×1024（1:1）

**提示词**：

```
DreamChord visual novel sprite, anime character portrait icon, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no illustration background scene, no portrait photography style. Miya, an 18-year-old warm and grounded coffee shop girl, the reality anchor unaffected by node editing. Warm brown long hair tied in a loose low ponytail. Amber eyes, gentle and awake gaze. Wearing a cream-colored apron over a casual shirt. Soft afternoon light on her face. Centered portrait, healing and friendly mood, square 1:1 composition.
```

### 23. 宫默认立绘 `apps/web/public/assets/characters/miya_normal.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord visual novel sprite, anime character standing sprite, full body, centered composition, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no photography style. Miya, an 18-year-old coffee shop girl, the reality anchor unaffected by node editing. Warm brown long hair in a loose low ponytail, amber eyes, cream apron over a white blouse. She holds a small tray with one hand, posture relaxed and welcoming. Gentle expression, warm grounded presence.
```

### 24. 宫微笑 `apps/web/public/assets/characters/miya_smile.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord visual novel sprite, anime character standing sprite, full body, centered composition, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no photography style. Miya, coffee shop girl with warm brown hair and amber eyes, the reality anchor, cream apron over white blouse. She smiles warmly, eyes slightly narrowed, as if saying "take your time". She gently pushes a cup of coffee forward with one hand, without the cup touching the background.
```

### 25. 宫温柔 `apps/web/public/assets/characters/miya_warm.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord visual novel sprite, anime character standing sprite, full body, centered composition, clean line art, soft cinematic lighting, pastel purple-blue palette, gentle cel-shaded shading, consistent VN character proportions, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, high readability character design, no illustration background scene, no photography style. Miya, coffee shop girl with warm brown hair and amber eyes, the reality anchor, cream apron over white blouse. Soft, caring expression, head tilted slightly, hands clasped together. Comforting mood, warm grounded presence.
```

---

## 系统层角色 · Chord Layer

以下角色统一使用系统层风格种子：

```
DreamChord system layer, translucent glowing, UI particles, ethereal vector style, data-like light threads, soft vector anime, digital lifeform, pastel purple-blue-gold gradient, clean glowing edges, plain solid white background for cutout
```

> 系统层角色抠图后边缘可能有发光残留，可在 PS 中用「选择 → 颜色范围」选取白色区域删除，或用 `rembg` 工具的 `alpha-matting` 模式。

---

### 26. 空头像 `apps/web/public/assets/characters/sora_avatar.png`

**推荐尺寸**：1024×1024（1:1）

**提示词**：

```
DreamChord system layer, translucent glowing, UI particles, ethereal vector style, data-like light threads, soft vector anime, digital lifeform, pastel purple-blue-gold gradient, clean glowing edges. Character portrait icon of Sora, a translucent blank character made of light, the unwritten future. Silvery-white hair like glowing mist, pale golden eyes with soft luminescence. Simple white clothes with no details. Gentle curious expression. Plain solid white background, soft studio lighting, centered, isolated character for cutout. Ethereal, innocent, square 1:1 composition.
```

### 27. 空默认立绘 `apps/web/public/assets/characters/sora_normal.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord system layer visual novel sprite, anime character standing sprite, translucent glowing, UI particles, ethereal vector style, data-like light threads, soft vector anime, digital lifeform, pastel purple-blue-gold gradient, clean glowing edges, full body, centered composition, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, no illustration background scene, no photography style. Sora, a translucent blank character made of soft light, the unwritten future. Silvery-white hair, pale golden glowing eyes, simple white clothes. Body has a gentle glow and semi-transparent quality. He stands with hands clasped in front, giving a blank but friendly smile. Ethereal pastel tones.
```

### 28. 空好奇 `apps/web/public/assets/characters/sora_curious.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord system layer visual novel sprite, anime character standing sprite, translucent glowing, UI particles, ethereal vector style, data-like light threads, soft vector anime, digital lifeform, pastel purple-blue-gold gradient, clean glowing edges, full body, centered composition, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, no illustration background scene, no photography style. Sora, translucent light-made character with silvery-white hair and pale golden eyes, the unwritten future. Simple white clothes. He tilts his head to one side, eyes wide with curiosity, as if asking a question. Soft glowing particles around him. Innocent mood.
```

### 29. 空开心 `apps/web/public/assets/characters/sora_happy.png`

**推荐尺寸**：1200×1800（2:3，白底生成 → 抠图后透明）

**提示词**：

```
DreamChord system layer visual novel sprite, anime character standing sprite, translucent glowing, UI particles, ethereal vector style, data-like light threads, soft vector anime, digital lifeform, pastel purple-blue-gold gradient, clean glowing edges, full body, centered composition, flat white studio background, isolated character for sprite extraction, no environment, no props touching background, no illustration background scene, no photography style. Sora, translucent light-made character with silvery-white hair and pale golden eyes, the unwritten future. Simple white clothes. He smiles brightly, eyes closed in joy, arms slightly raised as if celebrating being given a name. Warm golden light particles around him. Joyful ethereal mood.
```

---

## 角色素材状态对齐表

角色可用表情状态与对应素材文件名（只列已有素材，不设无图状态）：

| 角色 | 可用状态 | 对应文件 |
|---|---|---|
| 雪 Yuki | normal / smile / surprised | `yuki_normal.png` / `yuki_smile.png` / `yuki_surprised.png` |
| 影 Ren | normal / smirk / serious | `ren_normal.png` / `ren_smirk.png` / `ren_serious.png` |
| 宫 Miya | normal / smile / warm | `miya_normal.png` / `miya_smile.png` / `miya_warm.png` |
| 空 Sora | normal / curious / happy | `sora_normal.png` / `sora_curious.png` / `sora_happy.png` |
| 系统幽灵 | normal | `system-ghost.png` |

> 如后续需要扩展（如 `yuki_determined.png`、`ren_glitch.png`），按生成顺序补充对应文件即可，代码配置同步更新。

---

## 重绘优先级建议

| 优先级 | 文件 | 原因 |
|---|---|---|
| P0 | `miya_*.png`（全部） | 当前风格偏油画厚涂，与其他角色差异最大，必须统一回 soft cinematic anime |
| P0 | `ren_*.png`（全部） | 当前偏暗黑写实，面部比例与其他角色不一致，需统一画风 |
| P0 | `sora_*.png`（全部） | 当前过淡、水彩感重，需强化系统层矢量发光感，提升可读性 |
| P1 | `yuki_*.png`（全部） | 当前为赛璐璐平涂，需加入 soft cinematic lighting 和 painterly shading 以匹配统一风格 |
| P1 | `system-ghost.png` | 新增素材，需按系统层风格生成 |
| P2 | 背景图 | 可在角色统一后再评估，目前背景风格相对一致 |
| P2 | `empty-projects.png`, `empty-nodes.png` | 建议按系统层风格重绘，与空、系统幽灵保持一致 |

---

## 生成工具建议

### 文生图

Midjourney / Stable Diffusion / 通义万相 / 即梦 / DALL·E

### 抠图（去白底，获得真透明 PNG）

| 工具 | 说明 |
|---|---|
| [remove.bg](https://www.remove.bg) | 在线一键，适合少量素材 |
| Photoshop「选择主体」→ 反选删除 | 精度最高，适合批量 |
| Python `rembg` 库 | `pip install rembg`，批量脚本处理 |
| Stable Diffusion Rembg 后处理节点 | 生成同时自动抠图 |

### 统一风格技巧

- 同一层级所有素材使用相同的风格种子前缀
- 同一角色所有表情使用相同 seed 或角色参考图（--cref / IP-Adapter）
- 生成后按上方路径直接拖入对应文件夹即可，无需改代码
- **所有立绘放入前必须确认已抠图为透明 PNG**，检查方法：在浏览器中打开图片，背景应为灰白棋盘格（表示真透明）而非彩色棋盘格（表示假透明）

---

## 立绘生成完整流程图

```
1. 复制对应角色的提示词
          ↓
2. 粘贴到 AI 生成工具（确保带负面提示词）
          ↓
3. 生成白底角色图（plain solid white background）
          ↓
4. 检查：角色居中、全身、线条干净、无棋盘格
          ↓
5. 用抠图工具去除白底（remove.bg / PS / rembg）
          ↓
6. 检查：背景为真透明（灰白棋盘格）、无白边残留
          ↓
7. 命名为对应文件名（如 yuki_normal.png）
          ↓
8. 放入 apps/web/public/assets/characters/
          ↓
9. 完成，无需改代码
```

---

## 使用方式

```md
1. 按 ASSETS.md 生成并放置素材到 apps/web/public/assets/ 对应目录。
   - 立绘必须先白底生成再抠图，不要直接放白底图
   - 背景和插画不需要抠图
2. 按 CHARACTERS.md 配置角色状态与 characterId 引用。
3. 按 DEMO_STORY.md 创建官方示例项目（seed.ts 已内置）。
4. 用户可复制该项目作为模板进行改编，替换成自己的角色和场景。
```
