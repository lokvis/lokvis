---
title: Quick Actions 主题定制
description: 通过 theme prop 或 CSS 变量定制 Quick Action 的颜色、圆角与字体——13 个 token、合并语义、暗 / 亮模式说明与覆盖模式。
draft: false
head: []
---

# Quick Actions 主题定制

Quick Action 组件（Layer 2：`ImageQuickCompress`、`ImageQuickResize` 等）支持两条互补的主题路径：

1. **`theme` prop** —— 传入 JS 对象，内联转换为 CSS 变量
2. **CSS 变量覆盖** —— 在你的样式表中覆盖 `--lokvis-*` 变量

两条路径都叠加在 `global.css` 中定义的 CSS 默认值之上。本指南覆盖 13 个 token、合并语义，以及暗 / 亮模式的故事。

## 13 个主题 token

`QuickTheme` 定义在 `apps/playground/src/components/tools/quick/theme.ts`：

| Token | CSS 变量 | 默认值（暗色） | 描述 |
|---|---|---|---|
| `primary` | `--lokvis-primary` | `#6366f1`（indigo-500） | 按钮选中态、链接 |
| `primaryHover` | `--lokvis-primary-hover` | `#4f46e5`（indigo-600） | 主色 hover |
| `background` | `--lokvis-bg` | `transparent` | 组件背景 |
| `surface` | `--lokvis-surface` | `#18181b`（zinc-900） | 卡片 / 面板背景 |
| `surfaceHover` | `--lokvis-surface-hover` | `#27272a`（zinc-800） | Hover 表面 |
| `border` | `--lokvis-border` | `#27272a`（zinc-800） | 边框、分隔线 |
| `text` | `--lokvis-text` | `#f4f4f5`（zinc-100） | 主文本 |
| `textMuted` | `--lokvis-text-muted` | `#71717a`（zinc-500） | 次要文本 |
| `success` | `--lokvis-success` | `#10b981`（emerald-500） | 压缩率（已节省） |
| `warning` | `--lokvis-warning` | `#f59e0b`（amber-500） | 压缩率（反而变大） |
| `error` | `--lokvis-error` | `#ef4444`（red-500） | 错误显示 |
| `radius` | `--lokvis-radius` | `0.5rem` | 圆角 |
| `fontFamily` | `--lokvis-font-family` | `inherit` | 字体族 |

所有 token 都是**可选的**。未指定的 token 回退到 `global.css` 中的 CSS 默认值（选择器组 `.lokvis-quick-compress, .lokvis-quick-resize, ...`）。

## 路径 1 — `theme` prop（JS 对象）

向任意 Layer 2 组件传入一个 partial `QuickTheme` 对象：

```tsx
import { ImageQuickCompress } from './tools/quick';

export function BrandedCompress() {
  return (
    <ImageQuickCompress
      theme={{
        primary: '#0ea5e9',       // sky-500
        primaryHover: '#0284c7',  // sky-600
        surface: '#0f172a',       // slate-900
        success: '#22c55e',       // green-500
        radius: '0.75rem',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    />
  );
}
```

### 合并语义

`theme` prop 是**合并**而非替换的。内部 `themeToCssVars()` 只为非空字段输出 CSS 变量：

```typescript
// from theme.ts
if (value !== undefined && value !== null && value !== '') {
  vars[THEME_KEY_TO_VAR[key]] = value;
}
```

所以传入 `theme={{ primary: '#0ea5e9' }}` 只会设置 `--lokvis-primary`——其他 token 都回退到 CSS 默认值。

### 优先级顺序

每个 Layer 2 组件的根 div 按以下顺序组装样式：

```tsx
style={{
  background: 'var(--lokvis-bg)',     // 1. CSS var reference
  color: 'var(--lokvis-text)',
  fontFamily: 'var(--lokvis-font-family)',
  ...cssVars,                         // 2. theme prop → CSS vars (overrides #1's var values)
  ...style,                           // 3. explicit style prop (wins)
}}
```

因此优先级是：**`style` prop > `theme` prop > `global.css` 中的 CSS 默认值**。

## 路径 2 — CSS 变量覆盖（无 JS）

如果你更偏好 CSS 而非 `theme` prop，在根类上覆盖 `--lokvis-*` 变量。每个 Layer 2 根 div 都自带一个类用于此目的：

| 工具 | 根类 |
|---|---|
| Compress | `lokvis-quick-compress` |
| Resize | `lokvis-quick-resize` |
| Convert | `lokvis-quick-convert` |
| Watermark | `lokvis-quick-watermark` |
| Crop | `lokvis-quick-crop` |
| Pipeline | `lokvis-quick-pipeline` |

```css
/* In your global stylesheet */
.my-app .lokvis-quick-compress {
  --lokvis-primary: #0ea5e9;
  --lokvis-surface: #0f172a;
  --lokvis-radius: 0.75rem;
}

/* Or scope to a wrapper class */
.brand-theme .lokvis-quick-resize,
.brand-theme .lokvis-quick-convert {
  --lokvis-primary: #ec4899;  /* pink-500 */
  --lokvis-border: #fce7f3;
}
```

该路径**无需 `!important`** —— CSS 变量级联自然胜出，因为变量定义在消费它的同一元素上。

### 为什么用 CSS 变量（而不是 Tailwind 覆盖）

默认 UI 用 Tailwind 工具类做布局（`flex`、`gap-3`、`p-3`、`rounded-lg`），但**所有颜色、圆角与字体都引用 `var(--lokvis-*)`**——绝不硬编码 hex。这意味着：

- `theme` prop 与 CSS 变量覆盖会影响**每一个**子组件（Upload 框边框、Preview caption、PresetSwitcher 选中态、RatioBadge 颜色、DownloadButton hover 等）
- 你不需要 `!important` 来覆盖颜色
- 你可以通过在父元素上设置变量来一次性给多个工具换主题

## 路径 3 — 按工具隔离主题

要让每个工具用不同主题，在 wrapper 上用一个 CSS 类，然后定向到具体的 `lokvis-quick-*` 类：

```css
.dashboard .lokvis-quick-compress { --lokvis-primary: #ef4444; }  /* red */
.dashboard .lokvis-quick-resize   { --lokvis-primary: #3b82f6; }  /* blue */
.dashboard .lokvis-quick-convert  { --lokvis-primary: #10b981; }  /* green */
```

## 暗 / 亮模式

`global.css` 中的 CSS 默认值今天**仅暗色模式**。要支持亮色模式：

### 方案 A —— 按父类切换 CSS 变量

```css
/* Default (dark) inherited from global.css */

/* Light mode: opt-in via .light class on a parent */
.light .lokvis-quick-compress,
.light .lokvis-quick-resize,
.light .lokvis-quick-convert,
.light .lokvis-quick-watermark,
.light .lokvis-quick-crop,
.light .lokvis-quick-pipeline {
  --lokvis-bg: #ffffff;
  --lokvis-surface: #f4f4f5;
  --lokvis-surface-hover: #e4e4e7;
  --lokvis-border: #d4d4d8;
  --lokvis-text: #18181b;
  --lokvis-text-muted: #71717a;
}
```

然后在 `<html>` 或你的应用根上切换 `.light` 类。`@lokvis/ui-react` 的 `useTheme()` hook 控制 Workspace 的暗色模式，但目前**不会**级联到 Quick Action 组件——暂时自己接线切换类。

### 方案 B —— 按组件使用 `theme` prop

根据你的应用模式条件性地传入 `theme` 对象：

```tsx
const darkTheme: QuickTheme = { surface: '#18181b', text: '#f4f4f5' };
const lightTheme: QuickTheme = { surface: '#f4f4f5', text: '#18181b' };

function App() {
  const isDark = useIsDarkMode();
  return <ImageQuickCompress theme={isDark ? darkTheme : lightTheme} />;
}
```

## 覆盖布局（padding、gap 等）

颜色与圆角可通过 `--lokvis-*` 主题化。布局工具类（`flex`、`gap-3`、`p-3`、`rounded-lg`）是写进 JSX 的 Tailwind 类——覆盖它们需要：

1. **`className` prop** —— 追加你自己的、特异性更高的 Tailwind 类（例如 `className="p-6"` 可以在级联中靠后时覆盖默认的 `p-3`——但 Tailwind 的类顺序不保证）。
2. **`style` prop** —— 内联样式胜过类：`<ImageQuickCompress style={{ padding: '1.5rem', gap: '1rem' }} />`。
3. **`components` prop** —— 用你自己的整个子组件替换（例如 `UploadBox`）。参见 [Quick Actions 指南 §路径 4](./quick-actions#路径-4--组件-slot-替换)。
4. **Layer 1 primitive** —— 下到 Layer 1，完全自己掌控布局。参见 [Quick Actions 指南 §路径 5](./quick-actions#路径-5--primitive-组合radix-风格)。

对于默认子组件内部的内联样式（例如 `DefaultUploadBox` 的边框样式），唯一的覆盖路径是 `components` prop——内联样式在没有 `!important` 的情况下无法被 CSS 击败。

## 跨多个工具共享主题

要在多个 Quick Action 上应用同一主题而不重复 `theme` prop，可在父 wrapper 上用 CSS 变量：

```tsx
function ThemedDashboard() {
  return (
    <div className="brand-theme">
      <ImageQuickCompress />
      <ImageQuickResize />
      <ImageQuickConvert />
    </div>
  );
}
```

```css
.brand-theme {
  --lokvis-primary: #0ea5e9;
  --lokvis-surface: #0f172a;
  --lokvis-radius: 0.75rem;
  /* ...other tokens */
}
```

变量会级联到所有 `.lokvis-quick-*` 子元素。这是把品牌标识应用到整个 Quick Action 套件的推荐模式。

## Token 参考片段

如果你想从一个完整的 theme 对象起步（而非逐字段覆盖），下面是带暗色模式默认值的完整 token 集：

```tsx
import type { QuickTheme } from './tools/quick';

const myTheme: QuickTheme = {
  primary: '#6366f1',
  primaryHover: '#4f46e5',
  background: 'transparent',
  surface: '#18181b',
  surfaceHover: '#27272a',
  border: '#27272a',
  text: '#f4f4f5',
  textMuted: '#71717a',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  radius: '0.5rem',
  fontFamily: 'inherit',
};
```

拷贝、编辑后传给 `<ImageQuickXxx theme={myTheme} />`。
