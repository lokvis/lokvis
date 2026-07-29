---
'@lokvis/plugin-pdf': patch
'@lokvis/plugin-video': patch
'@lokvis/plugin-audio': patch
---

消除 plugin-pdf/video/audio node/web 实现重复

**@lokvis/plugin-pdf**
- 新增 `real-plugin.ts`:抽取 Node/Web 共享的真实实现骨架(8 capability 绑定 + PDF 页数 MetadataReader + info 日志),经 `buildRealPdfPlugin(options)` 一次性构造
- `node-plugin.ts` / `web-plugin.ts` 收敛为薄封装,仅注入环境相关文案(stub 错误短语 + 日志引擎描述),公开导出保持不变
- `operations.ts` 的 `derivePdfMetadata` 改为导出,供共享骨架复用

**@lokvis/plugin-video / @lokvis/plugin-audio**
- `deriveVideoMetadata` / `deriveAudioMetadata` 改由各自 `operations.ts` 导出,node/web plugin 删除本地副本改为 import(消除三处重复定义)

