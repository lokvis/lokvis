---
"@lokvis/engine-pdf": minor
"@lokvis/engine-video": minor
"@lokvis/plugin-pdf": minor
"@lokvis/plugin-video": minor
---

## @lokvis/engine-pdf / @lokvis/engine-video

- 内部对齐 stub 检测依赖

## @lokvis/plugin-pdf / @lokvis/plugin-video

- 新增 stub 自动检测:若底层 engine 不可用则 `status: 'stub'`,使 `CapabilityRegistry.resolve()` 不再解析到占位实现
