---
'@lokvis/ui-react': minor
---

Workspace 组件 6 语言 i18n 支持（en/zh/ja/es/de/fr）:

- 新增 `WorkspaceI18nProvider` / `useWorkspaceLang` / `useWorkspaceTranslations`,语言检测优先级:显式 locale prop > Provider > `document.documentElement.lang`(含 `zh-CN` 等子标签) > URL 路径前缀
- 全部 Workspace 组件文案接入包内 6 语言字典(`src/i18n/ui.ts`),支持消费方 `translations` prop 部分覆盖
- 复数形式使用 `Intl.PluralRules` 按 locale 选择 `*One` / `*Other` 键
- **Breaking(store API)**: `statusMessage` 由 `string` 改为 `I18nMessage`(`{ key, params }`),`setStatus(key, params?)` 签名变更,`error` 类型变为 `string | I18nMessage`。组件在渲染时通过 `formatMessage` 翻译;原始字符串(如引擎错误文本)原样透传
