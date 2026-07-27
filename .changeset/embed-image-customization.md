---
'@lokvis/embed-image': minor
---

embed-image 定制化补强：

- 新增 `useInputBlobImport` hook：外部 Blob 直接注入工作流（inputBlob 缺口）
- 包入口导出 `ImageInfo` / `formatBytes` / `BusyOverlayProps` / `FileInfoBarProps`
- 6 个 Layer-2 组件的 `BusyOverlay` / `FileInfoBar` 升级为 components slot
- i18n 空洞补齐：上传提示 / 拖拽提示 / 占位符 / 压缩率前后缀 / 预设按钮
  （Compress / Watermark / Crop / Pipeline / Favicon）全部接入 6 语言字典，
  翻译经父级注入（修复 Favicon 内部 useLang 忽略 locale prop 的不一致）
- 修复 Compress `DownloadButton` 硬编码 extension='webp'：改为按
  outputBlob.type 推断（guessExtension），显式 extension prop 仍优先
