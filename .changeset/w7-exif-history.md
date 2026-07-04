---
"@lokvis/schema": minor
"@lokvis/engine-image": minor
"@lokvis/ui-react": minor
"@lokvis/runtime": minor
---

- **W7.3 EXIF 读取**:新增 `readExif(blob)`,基于 exifr 库提取相机型号 / 拍摄时间 / ISO / 光圈 / 快门 / 焦距 / GPS 等结构化字段;解析失败或无 EXIF 返回 null,不阻塞主流程。`ExifData` / `ExifRow` 类型与 `formatExifRows` 纯函数定义在 `@lokvis/schema`(供 UI 直接调用,避免跨层依赖 Engine)
- **W7.4 EXIF 面板**:新增 `<ExifPanel />` 组件,展示选中 image asset 的 EXIF 元数据;按 assetId 缓存解析结果(LRU 上限 16,剔除 raw 字段控内存),支持加载/空态/错误三态;接入 `<Inspector />` 顶部;通过 `runtime.readAssetExif(id)` 桥接,UI 不直接依赖 Engine 包
- **Runtime readAssetExif**:新增 `LokvisRuntime.readAssetExif(id)`,内部用变量驱动动态 import 加载 `@lokvis/engine-image`(绕过 TS 模块解析,保持五层架构单向依赖)
- **W7.1 历史栈 UI**:新增 `<HistoryPanel />` 与 `history-slice`,支持列表展示 / undo / redo / jumpTo;通过 runtime-slice 订阅 `history:changed` 事件桥接(订阅句柄迁到 store 闭包,多 store 实例隔离)
- **W7.2 历史持久化**:新增 `HistoryStore`(独立 Dexie 库 `lokvis-history`),`runtime.loadPersistedHistory()` 在工厂启动时预加载;`onChanged` 回调驱动 `persistHistory` 写回;加载期间被跳过的变更记入 `dirtyDuringLoad` Set,加载结束后补 persist(避免丢变更)
- **W7.6 水印批量工具**:新增 playground 水印批量工具页(text / position / opacity / fontSize / color 五元组参数,并发 4);processItem 各路径(成功/失败/取消/清空)补 `removeAsset` + `disposeWorkflow` 清理资产;processing 中禁用清空 + 取消按钮(防竞态)
