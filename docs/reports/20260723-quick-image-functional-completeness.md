# @lokvis/embed-image 功能完整性任务计划（2026-07-23）

> **本文档是 @lokvis/embed-image Layer 2 默认 UI 功能缺口修复的任务拆解与执行基线**。起因：lokvis-cloud 接入 `@lokvis/embed-image@0.1.1` 后反馈 Layer 2 默认 UI 体验问题；经边界评审，问题拆为「功能缺口」（open 侧修，本文档）与「交互/视觉设计」（消费方自建，见 [lokvis-cloud/docs/tasks/quick-image-native-ui.md](../../../lokvis-cloud/docs/tasks/quick-image-native-ui.md)）。
>
> 状态约定：`⬜ 待办` / `🟡 进行中` / `✅ 完成` / `⛔ 阻塞` / `❌ 取消` / `⏭️ 延后`
>
> 任务字段沿用 `20260718-phase2-4-task-plan.md` 模板：范围 / 不做 / 输入 / 输出 / 依赖 / 验收 / 估时 / 风险 / 优先级。

---

## 一、边界原则（独立性守护）

> 本节是全部任务的准入门槛。@lokvis/embed-image 是 MIT 开源包，消费方包括 playground、lokvis-cloud、第三方站点。任何改动不得将单一消费方的产品决策泄漏进包。

### 1.1 中性第三方测试

**每项交互/视觉改动必须回答：「一个中性第三方站点（无自有设计系统、零配置接入）是否也需要这个？」**

- 答案为「是」→ 属于功能完整性，进 open（本文档范围）
- 答案为「否，只有某消费方需要」→ 属于产品决策，不进 open；消费方通过 Layer 0 hooks / Layer 1 primitives / `components` prop 自建

### 1.2 进 / 不进 清单

| 进 open（本文档） | 不进 open（消费方自建） |
|---|---|
| 处理状态视觉反馈（busy 指示） | 品牌色（cloud violet / 任何消费方主色） |
| 文件信息展示（尺寸/大小/格式） | 特定布局比例（大 drop zone / 紧凑卡片） |
| light/dark/system 色彩自适应 | 品牌动效（fade-in-up / stagger） |
| CSS 变量默认值随包发布（当前缺失） | 特定字体 / 圆角 / 阴影体系 |
| a11y（键盘 / aria-live / focus） | 转化出口（Expand to full workspace） |
| i18n 键补全（6 语言） | 埋点 / 状态栏 / 付费墙等产品交互 |

### 1.3 三层架构不变

本次修复**不改变**三层架构（Layer 0 hooks / Layer 1 primitives / Layer 2 default UI）与公共 API。Layer 2 仅提升实现质量，新增 props 向后兼容（`mode` 为可选新增）。hooks 接口冻结（cloud 已基于 0.1.1 hooks 构建，承诺向后兼容）。

---

## 二、现状评估（功能缺口清单）

> 核对基准：`@lokvis/embed-image@0.1.1`（commit a2a2540 发布）

| # | 缺口 | 位置 | 影响 | 严重度 |
|---|---|---|---|---|
| G1 | **无处理状态反馈**：hook 有 `busy`，Layer 1 仅用于禁用按钮（primitives/QuickCompress.tsx:134,195,201），Layer 2 不渲染任何 spinner/shimmer/processing 文案 | ImageQuickCompress.tsx 等 6 个 Layer 2 文件 | 用户拖入文件后无反馈，误以为无响应 | 🔴 高 |
| G2 | **无文件信息展示**：hook 已返回 `inputInfo`/`outputInfo`（width/height/size/format），Layer 2 不渲染 | 同上 | 用户无法确认输入输出 | 🟡 中 |
| G3 | **CSS 变量默认值不随包发布**：`--lokvis-*` 默认值只存在于 `apps/playground/src/styles/global.css:42-60`，npm 包自身样式引用未定义变量（`var(--lokvis-surface)` 无 fallback） | theme.ts:69 注释 + 6 个 Layer 2 文件 inline style | **第三方 npm 接入直接样式崩坏**（变量未定义 → invalid）；只有 playground 内正常 | 🔴 高 |
| G4 | **暗色优先硬编码，无 light/dark 适配**：默认调色板 `surface #18181b / text #f4f4f5`（zinc-900 系），浅色站点接入需手动全量覆盖 theme | playground global.css:50-57 + theme.ts | 浅色站点（多数第三方）默认即错 | 🟡 中 |
| G5 | **a11y 不完整**：drop zone 无键盘操作（仅 Layer 1 点击）、结果区无 aria-live、无 focus-visible 环 | primitives/*/Upload + Layer 2 | 键盘用户无法独立完成流程 | 🟡 中 |
| G6 | **i18n 键不足**：每工具仅 10 键，缺 drop zone 细节（格式/大小提示）、文件信息标签、换图入口、处理状态完整文案 | i18n/ui.ts（60 键） | 文案不完整，消费方需 translations 覆盖 | 🟢 低 |
| G7 | **6 工具 × ~320 行重复**：upload box/preview/preset pill/button 各实现一遍 | ImageQuick{Compress,Resize,Convert,Watermark,Crop,Pipeline}.tsx | 维护成本高，缺口修复需改 6 处 | 🟢 低（内部） |

**核心结论**：G1/G3 为高严重度功能缺口（G3 是 npm 发布质量问题，影响所有包外消费方）；G2/G4/G5 为体验缺口；G6/G7 为完整性/维护性问题。全部属于「中性第三方也需要」，符合 §1.1 准入门槛。

---

## 三、任务总览

| 任务 | 内容 | 估时 | 优先级 | 依赖 | 状态 |
|---|---|---|---|---|---|
| F1 | CSS 变量默认值随包发布 + mode 自适应主题 | 3h | P0 | 无 | ⬜ |
| F2 | 处理状态视觉反馈（G1） | 2h | P0 | F1 | ⬜ |
| F3 | 文件信息展示（G2） | 2h | P0 | F1 | ⬜ |
| F4 | a11y 补全（G5） | 2h | P1 | F2/F3 | ⬜ |
| F5 | i18n 键补全（G6，6 语言） | 2h | P1 | F2/F3 | ⬜ |
| F6 | shared-ui 内部去重（G7） | 3h | P2 | F2/F3 | ⬜ |
| F7 | 测试更新 + typecheck + release 0.2.0 | 2h | P0 | F1-F6 | ⬜ |
| **合计** | | **16h** | | | |

> **排期**：与 lokvis-cloud 改造完全解耦（cloud 用 Layer 0 hooks，不等待本文档）。F1-F3（P0，7h）优先，F4-F6 可并行，F7 收尾发布。

---

## 四、任务明细

### F1 · CSS 变量默认值随包发布 + mode 自适应主题（3h P0）

- **范围**：
  1. 将 `--lokvis-*` 默认值从 playground global.css 迁入包内，随 npm 发布（解决 G3）：
     - 方案：新增 `src/styles.css`（定义 `.lokvis-quick-*` 选择器默认值），package.json `exports` 增加 `./style.css`，并在 Layer 2 根元素 inline style 为每个变量加 fallback（`var(--lokvis-surface, #fff)`）双保险
  2. 新增 `mode?: 'light' | 'dark' | 'system'` prop（默认 `'system'`，matchMedia 检测 + change 监听），解决 G4：
     - 默认调色板改为 **light-first 中性色**（surface 白 / text 近黑 / border 浅灰），dark 提供配套深色板
     - 全部仍走 `--lokvis-*` 变量名（向后兼容第三方 CSS 覆盖），`theme` prop 优先级最高（不变）
  3. playground global.css 中的 `.lokvis-quick-*` 默认值块移除（改由包提供），playground 仅保留自身需要的覆盖
- **不做**：不改 `--lokvis-*` 变量名；不新增 cloud 品牌色；不改 Layer 2 布局骨架
- **输入**：theme.ts、playground/src/styles/global.css:42-60、6 个 Layer 2 文件
- **输出**：`src/styles.css`（新）、theme.ts（mode 逻辑 + light/dark 默认板）、package.json（exports + sideEffects）、6 个 Layer 2 文件（mode prop 接线 + fallback）、playground global.css（清理）
- **依赖**：无
- **验收**：
  - 新建空白 Vite 项目 `npm i @lokvis/embed-image` + 仅导入组件（不导入 style.css）：样式不崩坏（inline fallback 生效）
  - 导入 style.css 后：浅色页面默认浅色板；`mode="dark"` 渲染深色板；`mode="system"` 跟随系统
  - theme prop 覆盖优先于 mode 默认板
  - playground 视觉不回归（默认板切换后 playground 仍可接受，必要时 playground 用 theme prop 微调）
- **估时**：3h
- **风险**：默认板从暗色切浅色，playground 现有页面视觉变化 → F1 完成后 playground 全量 quick 页面走查，必要时 playground 显式传 `mode="dark"` 保持原貌
- **优先级**：P0

### F2 · 处理状态视觉反馈（2h P0）

- **范围**：
  1. Layer 2 渲染 `busy` 状态：output 预览区 shimmer + 居中 spinner overlay + 容器 `aria-busy="true"`
  2. 显示 per-tool processing 文案（i18n 已有 `quickCompress.processing` 等键）
  3. busy 期间 preset 按钮禁用态已有（Layer 1），补充视觉灰显
- **不做**：不改 hook 的 busy 时序；不加进度条（单图处理无需）
- **输入**：6 个 Layer 2 文件的 PreviewBox 默认组件、i18n processing 键
- **输出**：6 个 Layer 2 文件（busy 渲染）
- **依赖**：F1（spinner/shimmer 颜色走 `--lokvis-*` 变量）
- **验收**：拖入大图（>5MB）可观察到 output 区 shimmer + spinner + processing 文案；处理完成自动消失；`aria-busy` 正确切换
- **估时**：2h
- **风险**：6 文件重复改动（F6 去重后收敛）→ 可接受，F6 在 F2/F3 后统一收敛
- **优先级**：P0

### F3 · 文件信息展示（2h P0）

- **范围**：
  1. input/output 预览卡底部信息栏：format badge · `{width}×{height}` · `formatBytes(size)`（`formatBytes` 已在 internal/download.ts，提升为包内共享 util）
  2. 无输出时信息栏隐藏（不渲染空占位）
- **不做**：不做 EXIF/色彩空间等深度信息；不做信息栏自定义 prop（YAGNI）
- **输入**：hook 的 `inputInfo`/`outputInfo`（ImageInfo: width/height/size/format）、internal/download.ts formatBytes
- **输出**：6 个 Layer 2 文件（信息栏）、internal/download.ts（formatBytes 导出不变，仅复用）
- **依赖**：F1（信息栏颜色走变量）
- **验收**：上传后 input 卡显示 `PNG · 1920×1080 · 2.4 MB`；处理完成后 output 卡显示对应信息；format badge 与实际输出格式一致
- **估时**：2h
- **风险**：无
- **优先级**：P0

### F4 · a11y 补全（2h P1）

- **范围**：
  1. drop zone 键盘可访问：`role="button"` + `tabIndex={0}` + Enter/Space 触发文件选择 + `aria-label`（i18n）
  2. 结果区 `aria-live="polite"`：处理完成/错误时屏幕阅读器播报（指标文案/错误文案）
  3. focus-visible 环：新增 `--lokvis-ring` 变量，所有可交互元素（preset pill / download / reset / drop zone）统一 focus 样式
- **不做**：不做完整 WCAG 审计（范围外）；不改 Layer 1 原语 API
- **输入**：primitives/*/Upload、Layer 2 默认组件、theme.ts
- **输出**：primitives 6 文件（Upload 键盘）、Layer 2 6 文件（aria-live + focus 类）、theme.ts（--lokvis-ring）
- **依赖**：F2/F3（播报内容依赖状态渲染）
- **验收**：纯键盘完成完整流程（Tab 到 drop zone → Enter 选文件 → Tab 到 preset → Tab 到 download）；屏幕阅读器（macOS VoiceOver）播报处理结果
- **估时**：2h
- **风险**：Layer 1 Upload 原语改动需保持 API 兼容 → 仅新增内部键盘处理，不改 props
- **优先级**：P1

### F5 · i18n 键补全（2h P1）

- **范围**：
  1. 每工具补充：drop zone 细节（支持格式 + 大小上限）、文件信息标签（Original/Result）、换图入口（Change image）、尺寸/大小单位
  2. 共享键提取：`common.dropFormats` / `common.changeImage` / `common.original` / `common.result`（避免 6 工具重复）
  3. 6 语言全量翻译（en/zh/ja/es/de/fr），zh 遵循 locale 模板习惯（不直译 en 语序）
- **不做**：不重构 i18n Provider 架构（ui.ts 注释中的 "Task 2" 另立计划）
- **输入**：i18n/ui.ts（现 60 键）
- **输出**：i18n/ui.ts（补键，预计 +20 共享键）、6 个 Layer 2 文件（接入新键）
- **依赖**：F2/F3（新键服务于新渲染内容）
- **验收**：6 语言无缺失键（构建期 key 完整性检查或测试断言）；zh/ja 页面文案自然
- **估时**：2h
- **风险**：6 语言翻译质量 → es/de/fr 可用可靠翻译，标注待母语校对
- **优先级**：P1

### F6 · shared-ui 内部去重（3h P2）

- **范围**：
  1. 提取 `internal/shared-ui.tsx`：`QuickDropZone` / `QuickPreviewCard`（含信息栏 + busy overlay）/ `QuickPresetPills` / `QuickActionBar` / `QuickErrorAlert`
  2. 6 个 Layer 2 文件改为组合 shared-ui，各工具仅保留差异点（compress=ratio badge / resize=dimension badge / convert=format badge / watermark=文字输入 / crop=裁剪框 / pipeline=步骤列表）
- **不做**：不改公共 API（ImageQuick* props 不变）；不改 Layer 1 原语；不引入新依赖
- **输入**：6 个 Layer 2 文件（F2/F3 完成后）
- **输出**：internal/shared-ui.tsx（新）、6 个 Layer 2 文件（瘦身，预计各 320→~150 行）
- **依赖**：F2/F3（先修缺口再去重，避免重复改动）
- **验收**：6 工具视觉与 F2/F3 完成后完全一致（截图对比）；Layer 2 总行数下降 >40%；现有 Layer 2 测试全过
- **估时**：3h
- **风险**：去重引入回归 → 依赖 F7 测试覆盖 + 截图对比
- **优先级**：P2（维护性收益，不阻塞发布；工期紧可延后，F2/F3 的 6 文件重复为可接受中间态）

### F7 · 测试更新 + typecheck + release 0.2.0（2h P0）

- **范围**：
  1. 更新 Layer 2 测试（`src/__tests__/ImageQuick*.test.tsx` 等 13 个测试文件）：新增 busy 渲染断言、文件信息断言、mode 切换断言、键盘交互断言
  2. `pnpm typecheck`（全包）+ `pnpm test`（覆盖率不低于现状：lines 60%+ / branches 75%+）
  3. playground 回归：6 个 quick 工具页（`/tools/quick-*`）浏览器走查
  4. 版本 0.1.1 → **0.2.0**（Layer 2 视觉与默认值变更，0.x 语义下 minor  bump）；CHANGELOG 记录；npm publish
- **不做**：不改 hooks 接口（冻结，向后兼容承诺）
- **输入**：F1-F6 产出、现有测试套件
- **输出**：测试更新、CHANGELOG.md、package.json 0.2.0、npm 发布
- **依赖**：F1-F6
- **验收**：
  - `pnpm typecheck` 0 errors，`pnpm test` 全过
  - playground 6 个 quick 页面无回归
  - 空白 Vite 项目接入 0.2.0 冒烟通过（浅色默认 + style.css 可选 + mode 切换）
  - npm publish 成功，`npm view @lokvis/embed-image version` = 0.2.0
- **估时**：2h
- **风险**：默认板变更影响 playground → F1 已含 playground 走查；发布前再次确认
- **优先级**：P0

---

## 五、发布策略与向后兼容

| 层 | 本次变更 | 兼容性 |
|---|---|---|
| Layer 0 hooks | **不变（冻结）** | lokvis-cloud 已基于 0.1.1 hooks 构建原生 UI，承诺向后兼容 |
| Layer 1 primitives | 仅 Upload 内部新增键盘处理 | props API 不变 |
| Layer 2 default UI | 视觉/状态/默认值变更 + 新增 `mode` prop | props 向后兼容；视觉变化在 0.x 下属预期，minor bump 0.2.0 |
| CSS 变量 | `--lokvis-*` 名称不变，默认值随包发布 + light-first | 第三方已有 CSS 覆盖不受影响 |

**与 cloud 的解耦**：cloud 消费 Layer 0 hooks（接口冻结），本文档的发布节奏不阻塞 cloud；cloud 亦不依赖 0.2.0。两侧独立推进。

---

## 六、决策日志

### 2026-07-23 · 边界评审：功能缺口 vs 交互/视觉设计

- **背景**：lokvis-cloud 接入 0.1.1 后反馈 Layer 2 默认 UI「风格不匹配、太粗糙、布局不适合」
- **评审结论**：问题分两类——
  - 功能缺口（G1-G7）：所有消费方共同受害，open 侧修（本文档）
  - 交互/视觉设计：cloud 品牌化诉求，cloud 基于 Layer 0 hooks 自建（cloud 侧文档），不进 open
- **被否决的方案**：「open 重做 Layer 2 以匹配 cloud 设计系统」——违反中性第三方测试，视觉桥接无法表达 cloud 品牌元素（阴影/圆角/字体/动效），交互编排进 open 会向第三方泄漏 cloud 产品决策
- **确立原则**：§1.1 中性第三方测试 + §1.2 进/不进清单 + hooks 接口冻结
- **发现的高严重度问题**：G3（CSS 变量默认值不随包发布）——npm 包样式引用未定义变量，第三方接入直接崩坏，此前仅 playground 内可见。F1 优先修复

---

## 文档导航

- [→ lokvis-cloud：Tool 页 Quick Image 原生 UI 改造](../../../lokvis-cloud/docs/tasks/quick-image-native-ui.md)
- [← 20260719-image-workspace-ui-design.md（三层架构设计）](./20260719-image-workspace-ui-design.md)
- [← 20260718-phase2-4-task-plan.md（任务模板基线）](./20260718-phase2-4-task-plan.md)

---

*本文档基于 2026-07-23 边界评审编制。任务字段模板沿用 20260718-phase2-4-task-plan.md。*
