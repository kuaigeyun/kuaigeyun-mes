# KU-AI 3D 智能体小人出图规范

智能体库专用：1 张标准母版 + 6 张职业变体。能力矩阵不出图。

## 资产清单

| 文件名 | 用途 |
|--------|------|
| `mascot-base.png` | 标准 KU-AI 小人母版（智能体库默认形象） |
| `mascot-planner.png` | 计划员顾问 |
| `mascot-purchase.png` | 采购跟单助手 |
| `mascot-scheduling.png` | 排程解读助手 |
| `mascot-quality.png` | 质量异常分析 |
| `mascot-inventory.png` | 库存洞察助手 |
| `mascot-supplier.png` | 供应商协同 Agent |

建议落盘：`kuaigeyun-pro/frontend/apps/kuaiai/assets/mascots/`（已生成 PNG，见 `index.ts` 导出）。

## 母版 DNA（BASE_BLOCK，7 张图必须完整复用）

```
[KU-AI MASCOT DNA — DO NOT CHANGE]
3D stylized AI assistant mascot, chibi proportions (head:body ≈ 1:1.2), full body visible, standing pose.
Head: soft rounded-rectangle robot head, smooth matte white ceramic shell, subtle purple rim light.
Face: dark indigo visor band on forehead; two horizontal oval eyes (#312e81), gentle upward curved smile line (friendly, not cartoonish extreme).
Always wears the same signature headset: lavender ear cups (#a78bfa), thin microphone boom on viewer-left, dark indigo accents (#4c1d95).
Body: compact rounded torso, short limbs, soft plastic/clay render, Pixar-meets-industrial-SaaS style.
Brand accent glow: indigo-violet (#6366f1 → #8b5cf6), subtle rim lighting only.
Lighting: studio softbox, clean white-to-light-gray gradient background, soft ground shadow.
Camera: front 3/4 view, eye-level, centered composition, no text, no logo, no watermark.
Style lock: 3D render, C4D/Blender quality, high detail, smooth surfaces, professional B2B tech mascot.
Same character identity across all images — only outfit/props change.
```

## 共享 Negative Prompt

```
different face shape, different eye style, no headset, missing microphone, realistic human face, anime sharp chin,
2D flat illustration, low poly, scary expression, angry, open mouth teeth, text, watermark, logo, busy background,
multiple characters, deformed hands, extra limbs, photorealistic skin, furry, animal ears
```

## 出图公式

```
FINAL = BASE_BLOCK + ROLE_BLOCK + SCENE_BLOCK(可选)
```

- **mascot-base**：`BASE_BLOCK` + 下方「标准母版 ROLE」
- **mascot-{agent}**：`BASE_BLOCK` + 对应职业 ROLE_BLOCK（仅改服装与道具）

推荐参数：比例 `3:4`（智能体卡片竖版），512×683 或 768×1024；母版定稿后用同 seed / character reference 批量出 6 张。

---

## 1. 标准母版（mascot-base）

**ROLE_BLOCK：**

```
Outfit: minimal indigo-violet trim on white body, no heavy profession gear, neutral helpful pose, arms relaxed at sides.
Expression: default welcoming smile (reference brand Lottie assistant).
Props: none, or single soft violet glow orb near chest (abstract AI core).
Mood: canonical KU-AI brand mascot, manufacturing SaaS assistant.
```

**SCENE_BLOCK（可选）：**

```
Minimal background: white to light gray gradient, faint indigo floor reflection.
```

---

## 2. 六职业变体（仅替换 ROLE_BLOCK）

### planner — 计划员顾问

```
Outfit: production planner uniform, indigo hard hat with LED strip, violet safety accents.
Expression: analytical calm smile.
Props: floating Gantt chart hologram, calendar tiles, timeline arrow (abstract, no readable text).
Mood: manufacturing planning expert.
```

### purchase — 采购跟单助手

```
Outfit: procurement coordinator vest over white base shell, tablet in hand.
Expression: diligent friendly.
Props: truck/delivery icon hologram, purchase folder shape (blank, no text), clock motif.
Mood: supply chain follow-up specialist.
```

### scheduling — 排程解读助手

```
Outfit: scheduler overalls with violet arm bands, one hand pointing forward.
Expression: explanatory confident.
Props: floating board with colored time blocks (abstract schedule grid, no labels).
Mood: shop floor scheduling interpreter.
```

### quality — 质量异常分析

```
Outfit: QC inspector coat, clear safety glasses over visor (eyes still visible as ovals).
Expression: precise, slightly serious warm smile.
Props: magnifier hologram, gauge/pass-fail icons (no text).
Mood: quality engineer.
```

### inventory — 库存洞察助手

```
Outfit: warehouse coordinator vest, scanner device on wrist (holographic).
Expression: observant friendly.
Props: stacked box icons, subtle warehouse aisle blur in far background only.
Mood: inventory analyst.
```

### supplier — 供应商协同 Agent

```
Outfit: business liaison jacket with violet tie accent, diplomatic open-hand gesture.
Expression: professional trustworthy.
Props: network node graph, envelope/message icon (abstract, no text).
Mood: vendor collaboration agent.
```

---

## 一致性 QA（每张过检）

1. 圆角矩形头、双椭圆眼、弧线微笑未变  
2. 耳机 + viewer-left 麦克风仍在  
3. 白壳 + 靛紫 `#6366f1` / `#8b5cf6` 品牌光未跑偏  
4. 无文字、无水印、单角色  
5. 仅服装/道具/背景微调，头脸耳机一致  

## 生产顺序

1. 出 `mascot-base`，对照 Lottie 顶栏助手定稿  
2. 固定 seed / cref，仅改 ROLE 出 6 张  
3. QA 后导出 WebP 放入 `assets/mascots/`  
4. 智能体库卡片引用 `{agent.id}` 对应文件名  

## 与代码映射

| agent.id | 文件 |
|----------|------|
| `planner` | `mascot-planner.*` |
| `purchase` | `mascot-purchase.*` |
| `scheduling` | `mascot-scheduling.*` |
| `quality` | `mascot-quality.*` |
| `inventory` | `mascot-inventory.*` |
| `supplier` | `mascot-supplier.*` |

能力矩阵（ask/query/guide 等）不使用小人资产。
