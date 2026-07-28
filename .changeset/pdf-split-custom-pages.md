---
'@lokvis/embed-pdf': minor
---

`usePdfSplit` 支持自定义每份页数:

- `PdfSplitPreset` 新增 `'custom'` 预设(`PDF_SPLIT_PRESETS.custom` 为占位,实际值来自 state)
- 新增 `pagesPerFile` / `setPagesPerFile(n)`:设值自动切到 custom 预设并重跑;n<1 或非整数不触发 run
- options 新增 `initialPagesPerFile?`(传入时初始预设为 custom)
- `ranges` 按范围拆分暂不进 hook(进阶场景引导 full workspace)
