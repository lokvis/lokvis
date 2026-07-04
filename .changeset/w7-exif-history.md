---
"@lokvis/engine-image": minor
"@lokvis/ui-react": minor
"@lokvis/runtime": minor
---

- **W7.3 EXIF 读取**:新增 `readExif(blob)` 与 `formatExifRows(exif)`,基于 exifr 库提取相机型号 / 拍摄时间 / ISO / 光圈 / 快门 / 焦距 / GPS 等结构化字段;解析失败或无 EXIF 返回 null,不阻塞主流程
- **W7.4 EXIF 面板**:新增 `<ExifPanel />` 组件,展示选中 image asset 的 EXIF 元数据;按 assetId 缓存解析结果,支持加载/空态/错误三态;接入 `<Inspector />` 顶部
- **W7.1 历史栈 UI**:新增 `<HistoryPanel />` 与 `history-slice`,支持列表展示 / undo / redo / jumpTo;通过 runtime-slice 订阅 `history:changed` 事件桥接
- **W7.2 历史持久化**:新增 `HistoryStore`(独立 Dexie 库 `lokvis-history`),`runtime.loadPersistedHistory()` 在工厂启动时预加载;`onChanged` 回调驱动 `persistHistory` 写回
- **W7.6 水印批量工具**:新增 playground 水印批量工具页(text / position / opacity / fontSize / color 五元组参数,并发 4)
