---
title: Quick Actions Theme Customization
description: Customize Quick Action colors, radius, and typography via the theme prop or CSS variables — 13 tokens, merge semantics, dark/light notes, and override patterns.
draft: false
head: []
---

# Quick Actions Theme Customization

Quick Action components (Layer 2: `ImageQuickCompress`, `ImageQuickResize`, etc.) support two complementary theme paths:

1. **`theme` prop** — pass a JS object, converted to CSS variables inline
2. **CSS variable override** — override `--lokvis-*` variables in your stylesheet

Both paths layer on top of CSS defaults defined in `global.css`. This guide covers the 13 tokens, the merge semantics, and the dark/light story.

## The 13 theme tokens

`QuickTheme` is defined in `apps/playground/src/components/tools/quick/theme.ts`:

| Token | CSS variable | Default (dark) | Description |
|---|---|---|---|
| `primary` | `--lokvis-primary` | `#6366f1` (indigo-500) | Buttons selected state, links |
| `primaryHover` | `--lokvis-primary-hover` | `#4f46e5` (indigo-600) | Primary hover |
| `background` | `--lokvis-bg` | `transparent` | Component background |
| `surface` | `--lokvis-surface` | `#18181b` (zinc-900) | Card / panel background |
| `surfaceHover` | `--lokvis-surface-hover` | `#27272a` (zinc-800) | Hover surface |
| `border` | `--lokvis-border` | `#27272a` (zinc-800) | Borders, dividers |
| `text` | `--lokvis-text` | `#f4f4f5` (zinc-100) | Primary text |
| `textMuted` | `--lokvis-text-muted` | `#71717a` (zinc-500) | Secondary text |
| `success` | `--lokvis-success` | `#10b981` (emerald-500) | Compression ratio (saved) |
| `warning` | `--lokvis-warning` | `#f59e0b` (amber-500) | Compression ratio (increased) |
| `error` | `--lokvis-error` | `#ef4444` (red-500) | Error display |
| `radius` | `--lokvis-radius` | `0.5rem` | Border radius |
| `fontFamily` | `--lokvis-font-family` | `inherit` | Font family |

All tokens are **optional**. Unspecified tokens fall back to the CSS defaults in `global.css` (selector group `.lokvis-quick-compress, .lokvis-quick-resize, ...`).

## Path 1 — `theme` prop (JS object)

Pass a partial `QuickTheme` object to any Layer 2 component:

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

### Merge semantics

The `theme` prop is **merged**, not replaced. Internally, `themeToCssVars()` only emits CSS variables for non-empty fields:

```typescript
// from theme.ts
if (value !== undefined && value !== null && value !== '') {
  vars[THEME_KEY_TO_VAR[key]] = value;
}
```

So passing `theme={{ primary: '#0ea5e9' }}` only sets `--lokvis-primary` — every other token falls back to its CSS default.

### Precedence order

The root div of every Layer 2 component assembles styles in this order:

```tsx
style={{
  background: 'var(--lokvis-bg)',     // 1. CSS var reference
  color: 'var(--lokvis-text)',
  fontFamily: 'var(--lokvis-font-family)',
  ...cssVars,                         // 2. theme prop → CSS vars (overrides #1's var values)
  ...style,                           // 3. explicit style prop (wins)
}}
```

So the precedence is: **`style` prop > `theme` prop > CSS defaults in `global.css`**.

## Path 2 — CSS variable override (no JS)

If you prefer CSS over the `theme` prop, override the `--lokvis-*` variables on the root class. Every Layer 2 root div carries a class for this purpose:

| Tool | Root class |
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

This path requires **no `!important`** — the CSS variable cascade wins naturally because the variable is defined on the same element that consumes it.

### Why CSS variables (not Tailwind overrides)

The default UI uses Tailwind utility classes for layout (`flex`, `gap-3`, `p-3`, `rounded-lg`) but **all colors, radii, and fonts reference `var(--lokvis-*)`** — never hard-coded hex values. This means:

- `theme` prop and CSS variable overrides affect **every** sub-component (Upload box border, Preview caption, PresetSwitcher selected state, RatioBadge color, DownloadButton hover, etc.)
- You don't need `!important` to override colors
- You can theme multiple tools at once by setting variables on a parent element

## Path 3 — Per-tool theme isolation

To theme each tool differently, use a CSS class on a wrapper and target the specific `lokvis-quick-*` class:

```css
.dashboard .lokvis-quick-compress { --lokvis-primary: #ef4444; }  /* red */
.dashboard .lokvis-quick-resize   { --lokvis-primary: #3b82f6; }  /* blue */
.dashboard .lokvis-quick-convert  { --lokvis-primary: #10b981; }  /* green */
```

## Dark / light mode

The CSS defaults in `global.css` are **dark-mode-only** today. To support light mode:

### Option A — CSS variable swap by parent class

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

Then toggle a `.light` class on `<html>` or your app root. The `useTheme()` hook from `@lokvis/ui-react` controls the Workspace's dark mode but does **not** cascade to Quick Action components today — wire your own class toggle for now.

### Option B — `theme` prop per component

Pass a `theme` object conditionally based on your app's mode:

```tsx
const darkTheme: QuickTheme = { surface: '#18181b', text: '#f4f4f5' };
const lightTheme: QuickTheme = { surface: '#f4f4f5', text: '#18181b' };

function App() {
  const isDark = useIsDarkMode();
  return <ImageQuickCompress theme={isDark ? darkTheme : lightTheme} />;
}
```

## Overriding layout (padding, gap, etc.)

Colors and radius are themeable via `--lokvis-*`. Layout utilities (`flex`, `gap-3`, `p-3`, `rounded-lg`) are Tailwind classes baked into the JSX — overriding them requires either:

1. **`className` prop** — append your own Tailwind class with higher specificity (e.g. `className="p-6"` can override the default `p-3` if it appears later in the cascade — but Tailwind's class ordering is not guaranteed).
2. **`style` prop** — inline styles win over classes: `<ImageQuickCompress style={{ padding: '1.5rem', gap: '1rem' }} />`.
3. **`components` prop** — replace the entire sub-component (e.g. `UploadBox`) with your own. See the [Quick Actions guide §Path 4](./quick-actions#path-4--component-slot-replacement).
4. **Layer 1 primitives** — drop to Layer 1 and own the layout entirely. See [Quick Actions guide §Path 5](./quick-actions#path-5--primitive-composition-radix-style).

For inline styles inside default sub-components (e.g. `DefaultUploadBox`'s border style), the only override path is the `components` prop — inline styles cannot be beaten by CSS without `!important`.

## Shared theme across multiple tools

To apply the same theme to several Quick Actions without repeating the `theme` prop, use CSS variables on a parent wrapper:

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

The variables cascade to all `.lokvis-quick-*` children. This is the recommended pattern for applying a brand identity across the entire Quick Action suite.

## Token reference snippet

If you want to start from a complete theme object (instead of overriding one field at a time), here's the full token set with the dark-mode defaults:

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

Copy, edit, and pass it to `<ImageQuickXxx theme={myTheme} />`.
