---
"@lokvis/engine-image": minor
"@lokvis/plugin-image": patch
"@lokvis/runtime": patch
"@lokvis/schema": minor
"@lokvis/ui-react": patch
"@lokvis/embed-image": patch
"@lokvis/embed-pdf": patch
"@lokvis/embed-video": patch
---

低优先级清理(架构评审 #12)。

- **#1 删除死代码**:移除 runtime 中已无引用的 `worker-host.ts` 及其测试(能力执行早已走 executor 路径)。
- **#2 engine-image 适配器风格统一**:删除 `adapter.ts`,入口改为导出 `IMAGE_ENGINE` 引擎描述符(`{ name, version, supportedCapabilities }`)+ 独立 `decodeImage` / `encodeImage` 原语,与 `PDF_ENGINE` / `VIDEO_ENGINE` 对齐;plugin-image 及文档同步改用新契约,stub 检测统一走 `IMAGE_ENGINE.version.includes('stub')`。
- **#4 去重 download / formatBytes**:此前 4 套行为各异的 `formatBytes` 统一为一套(runtime 新增 `formatBytes`,带 NaN/Infinity 守卫,四级单位 + 空格),浏览器下载逻辑 `downloadBlob` 收敛至 embed-kit;ui-react / embed-image / embed-pdf / embed-video / playground 改为复用,消除重复实现(部分用户可见输出统一为带空格格式)。
- **#8 exif 格式化归位**:`formatExifRows` / `formatShutterSpeed` 从 schema 迁至 ui-react(展示逻辑归 UI 层),schema 仅保留 `ExifData` / `RawExifData` / `ExifRow` 类型;对应单测随函数迁移,类型分层测试保留在 schema。
