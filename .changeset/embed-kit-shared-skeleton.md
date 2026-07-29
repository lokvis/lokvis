---
'@lokvis/embed-kit': minor
'@lokvis/embed-image': patch
'@lokvis/embed-pdf': patch
'@lokvis/embed-video': patch
---

抽取 embed-image/pdf/video 共享骨架为 @lokvis/embed-kit(参数化保 API)

新增内部共享包 `@lokvis/embed-kit`,以工厂参数化三个 embed 包的重复骨架;各包改为薄封装并保留原有全部公开导出名与 CSS 变量命名空间,三方定制 API 不变:

- `createCaptureException(label)` — sentry 占位实现(--> `[embed-*] captured exception:`)
- `makeThemeSystem(prefix)` — 主题系统(`themeToCssVars` / `useEmbed*Mode` / `THEME_KEY_TO_VAR`),命名空间 `--lokvis` / `--lokvis-pdf` / `--lokvis-video`
- `createUseLokvisRuntime(defaultPluginsFactory)` — runtime 初始化 hook
- `makeSingleStepWorkflowBuilder(config)` — 单步 Workflow 构造器(image 专属 `buildResizeCompressWorkflow` 保留在包内)
- `createEmbedErrorBoundary(deps)` — 参数化 ErrorBoundary,统一为唯一正确的重试计数实现(实例字段累积,修复 embed-image/video 中 retryCount 每次错误被 `getDerivedStateFromError` 重置导致 MAX_RETRY 永不触发的缺陷)
