# @lokvis/engine-image

## 0.2.0

### Minor Changes

- 2aebedb: - 实现 `image.filter` 能力:基于 Canvas 2D `ctx.filter` CSS 语法,使用 `Record<FilterPreset, ...>` 保证穷尽性,`preset` 缺失/未知分别抛出区分性错误
  - 新增 `FilterPreset` / `FilterParams` 类型
  - `canvasEngine.supportedCapabilities` 同步追加 `image.filter`
  - Watermark:实现 tile 模式网格渲染(文本与图像),fetch 校验 `resp.ok`

### Patch Changes

- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
  - @lokvis/schema@0.2.0

## 0.2.0-beta.0

### Minor Changes

- - 实现 `image.filter` 能力:基于 Canvas 2D `ctx.filter` CSS 语法,使用 `Record<FilterPreset, ...>` 保证穷尽性,`preset` 缺失/未知分别抛出区分性错误
  - 新增 `FilterPreset` / `FilterParams` 类型
  - `canvasEngine.supportedCapabilities` 同步追加 `image.filter`
  - Watermark:实现 tile 模式网格渲染(文本与图像),fetch 校验 `resp.ok`

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.2.0-beta.0
