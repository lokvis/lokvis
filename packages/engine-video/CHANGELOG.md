# @lokvis/engine-video

## 0.2.0-beta.0

### Minor Changes

- ## @lokvis/engine-pdf / @lokvis/engine-video
  - 内部对齐 stub 检测依赖

  ## @lokvis/plugin-pdf / @lokvis/plugin-video
  - 新增 stub 自动检测:若底层 engine 不可用则 `status: 'stub'`,使 `CapabilityRegistry.resolve()` 不再解析到占位实现

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.2.0-beta.0
