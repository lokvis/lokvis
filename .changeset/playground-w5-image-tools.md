---
'@lokvis/playground': minor
---

W5: 新增 7 个图像工具页 + 共享工具基础设施

- Compress / Resize / Convert / Crop / Watermark 5 个单工具页,各自调用对应 image.* capability,提供 before/after 对比 + 下载
- BatchQueue:批量处理队列,并发 4 池,进度/状态追踪
- DownloadManager:单/批量下载管理(逐个下载,JSZip 打包延后)
- 共享 toolkit:useLokvisRuntime hook + UploadBox(拖拽+点击)+ PreviewBox + download 工具函数
- BaseLayout sidebar 分组:Demos + Tools (W5)
