# @lokvis/ui-react

> React Workspace UI for Lokvis — local-first image/video/PDF processing in the browser.

`@lokvis/ui-react` renders the full Lokvis Workspace (asset panel, canvas, workflow editor, inspector, status bar…) on top of `@lokvis/runtime` / `@lokvis/sdk`.

## Install

```bash
pnpm add @lokvis/ui-react @lokvis/sdk @lokvis/plugin-image
# peers: react react-dom
```

## Quick start

```tsx
import { Workspace } from '@lokvis/ui-react';
import { imageToolsPlugin } from '@lokvis/plugin-image';

<Workspace plugins={[imageToolsPlugin()]} />
```

## i18n

The package ships a built-in 6-language dictionary — `en` (default) / `zh` / `ja` / `es` / `de` / `fr` — covering all Workspace UI copy (labels, aria-labels, placeholders, tooltips, and store status/error messages).

### Language resolution priority

1. Component `locale` prop (highest, per-instance)
2. `WorkspaceI18nProvider` `locale` (app level)
3. `document.documentElement.lang`
4. URL path prefix (`/zh/...`)

Without any of these, the UI renders in English — identical to previous versions.

### Usage

```tsx
import { Workspace, WorkspaceI18nProvider } from '@lokvis/ui-react';

// Per-instance
<Workspace locale="zh" />

// App-level Provider (standalone components like ToolRunner inherit it too)
<WorkspaceI18nProvider locale="ja">
  <Workspace />
</WorkspaceI18nProvider>
```

`ToolRunner` and `WorkflowTemplates` also accept a standalone `locale` prop when used outside `Workspace`.

### Overriding copy

Pass a partial `translations` map (key → language → text). Missing languages fall back to the built-in dictionary:

```tsx
<Workspace
  locale="zh"
  translations={{
    'toolbar.run': { zh: '开始处理', en: 'Process' },
  }}
/>

// Or app-wide via the Provider
<WorkspaceI18nProvider locale="zh" translations={{ 'inspector.configure': { zh: '配置工具' } }}>
  <Workspace />
</WorkspaceI18nProvider>
```

Keys are namespaced as `<component>.<field>` (e.g. `toolbar.run`, `statusBar.online`, `status.importing`). See `src/i18n/ui.ts` for the full list.

### Store messages

Store-side messages (`statusMessage`, `error`) are stored as `{ key, params }` (`I18nMessage`), not plain strings — components translate them at render time via `formatMessage`. Raw strings (e.g. engine error text) pass through unchanged.

### Exported i18n API

| Export | Description |
|---|---|
| `WorkspaceI18nProvider` | Injects `locale` + optional `translations` |
| `useWorkspaceLang(locale?)` | Resolves current language via the priority chain |
| `useWorkspaceTranslations(lang, overrides?)` | Returns a `t(key, params?)` translate function |
| `t(lang, key, overrides?, params?)` | Pure translate function |
| `formatMessage(t, message)` | Renders `string \| I18nMessage` |
| `languages` / `langList` / `defaultLang` / `Language` | Language config |

Not in scope: runtime language-switcher UI, SSR locale negotiation. The dictionary is independent from `@lokvis/embed-image`'s (separate key namespaces).

## Testing

```bash
pnpm typecheck
npx vitest run packages/ui-react
```
