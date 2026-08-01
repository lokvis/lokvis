# ADR-015：Browser Adapter Layer（@lokvis/browser-adapter）

- **状态**：Accepted
- **日期**：2026-07-30
- **来源**：[architecture-v2 任务文档](../architecture-v2-tasks.md) 工作流 A（A1–A7）

---

## 背景

架构 v2 铁律之二：**业务逻辑不得直接依赖浏览器 API**。当前仓内直接触碰
原生浏览器 API 的位置分散在三层，且存在三处重复的"格式编码支持探测"实现：

| 包 | 位置 | 原生 API |
|---|---|---|
| runtime | `browser-detect.ts` | navigator / globalThis 全量能力探测 + UA 嗅探 |
| runtime | `asset-store.ts:145-191` | `createImageBitmap`（图片尺寸）、`document.createElement('video'/'audio')`（媒体时长） |
| runtime | `opfs-asset-store.ts:114` | `navigator.storage.getDirectory()` |
| runtime | `idb-asset-store.ts` / `history-store.ts` / `opfs-asset-store.ts` | IndexedDB（经 Dexie） |
| runtime | `managers/asset-manager.ts:94-99` | `navigator.storage.getDirectory()`（opfs 源导入） |
| engine-image | `canvas-engine.ts` | OffscreenCanvas / `document.createElement('canvas')` / createImageBitmap / toBlob |
| engine-image | `wasm/avif-encoder.ts:52` | `new Worker(...)` |
| embed-image | `internal/format-support.ts` | 1×1 画布编码探测（与 engine-image `detectFormatSupport` 重复） |

Runtime 层"摸 DOM"是最典型的违规（`document.createElement` 出现在资产导入
主路径），也导致 Node/SSR 环境靠 `typeof document === 'undefined'` 之类的
散落检查降级，测试必须全局 stub。

## 决策

新增 **`@lokvis/browser-adapter`** 包，作为**全仓唯一允许触碰原生浏览器 API
的非 Presentation 包**。五层架构扩展为六层：

```
UI (ui-react, embed-*)          ← Presentation，允许直接摸 DOM（UI 用途）
  ↓
Workflow (workflow)
  ↓
Runtime (runtime)
  ↓
Capability (plugin-*, capability)
  ↓
Engine (engine-*)
  ↓
Browser Adapter (browser-adapter) ← 唯一封装原生浏览器 API 的非 UI 包
```

依赖方向不变（单向向下）。schema 仍为全局共享类型层，不依赖 adapter。

### 接口面

adapter 按"能力域"导出独立模块（非一个巨型对象），全部满足
**环境安全（environment-safe）**约定：在 Node/SSR 下不抛
ReferenceError，以特性检测 + 优雅降级（返回空/false/抛语义化错误）代替。

| 模块 | 接口 | 迁移来源 |
|---|---|---|
| `EnvProbe` | `detectBrowserCapabilities()` / `detectBrowserInfo()` / `isSafari()` / `isFirefox()` / `isOpfsSupported()` / `isIdbSupported()` | runtime `browser-detect.ts` 整体 + 两个 store 的 isXxxSupported |
| `MediaProbe` | `probeImageDimensions(blob)` / `probeMediaDuration(blob, 'video'\|'audio')` | runtime `asset-store.ts` extractImageDimensions / extractMediaDuration |
| `StorageAdapter` | `getOpfsRoot()`（封装 `navigator.storage.getDirectory()`）| runtime opfs-asset-store / asset-manager |
| `KVStoreFactory` | `createKVStore<T>({ dbName, tableName, keyPath, indexes? })` → 泛型 `KVStore<T>`（get/put/delete/toArray/clear/close）| runtime 三个 Dexie 库（lokvis-assets / lokvis-opfs-metadata / lokvis-history）。**Dexie 依赖随之移入 adapter**，runtime 依赖树变轻 |
| `CanvasFactory` | `createCanvas(w,h)` / `get2DContext(canvas)` / `encodeCanvasToBlob(canvas, mime, quality)` / `decodeToBitmap(blob, resize?)` | engine-image `canvas-engine.ts` 的 createCanvas / get2DContext / 编码分支 / createImageBitmap 调用 |
| `WorkerFactory` | `createWorker(url, options)` / `isWorkerSupported()` | engine-image `wasm/avif-encoder.ts` |
| `FormatSupportProbe` | `detectEncodeSupport(formats)`（1×1 画布实编 + MIME 比对，静默回退判负）| engine-image `detectFormatSupport` 语义为准，统一 embed-image `internal/format-support.ts` 重复实现 |
| `FilePickerAdapter` | **预留**（File System Access showOpenFilePicker 等），本期仅类型定义 | — |

### 注入方式

1. **默认静态 import**。adapter 全部实现环境安全，行为与迁移前的散落
   特性检测完全等价，因此 runtime / engine-image / embed-image 直接
   `import { ... } from '@lokvis/browser-adapter'`，不强推 DI —— 避免为
   纯探测函数引入无收益的构造参数管道。
2. **可选注入点保留**：现有测试注入口不删（opfs store 的 `rootHandle` /
   `metadataDb`、idb store 的 `dbInstance` 语义迁移为 `kvStore` 注入；
   history store 同理）。runtime 的 MediaProbe 经 asset-store 内部间接
   使用，默认实现即 adapter（Node 下自然降级为无富元数据）。
3. **测试 fake**：adapter 提供 `createFakeAdapter()`（`test-utils` 子路径
   导出），返回可编程的 EnvProbe/MediaProbe/KVStore 等 fake，替代各包
   自行 `vi.stubGlobal`。存量测试不强制迁移，新测试优先用 fake。

### 分层裁决与豁免

- **adapter 是唯一允许触碰原生浏览器 API 的非 Presentation 包**。CI 守卫
  （A7 起）：`grep -rE "navigator\.|document\.|indexedDB|new Worker\(" packages/runtime/src packages/engine-image/src` 除测试文件外零命中。
- **Presentation 豁免**：embed-* / ui-* / apps 允许直接摸 DOM（download、
  theme、matchMedia 等 UI 行为），不受铁律约束；但**探测/编解码类逻辑**
  （如 format-support）必须走 adapter，避免与引擎行为漂移。
- **engine 直接 import adapter**：Engine 处于 L1（adapter 之上一层），
  静态依赖合法。Node 侧引擎（engine-image/node 的 sharp 路径）不 import
  adapter 浏览器实现，维持现状。
- **schema 不动**：AssetSource 等类型含 FileSystemDirectoryHandle 等
  DOM lib 类型仅为类型引用（编译期），不构成运行时依赖，不迁移。

### 兼容策略

- runtime 的 `browser-detect.ts` 改为从 adapter re-export 并标注
  `@deprecated`（下一个 major 移除），公共 API `export * from './browser-detect.js'`
  不破坏。
- `OpfsUnavailableError` / `IdbUnavailableError` 仍从 runtime 导出（SDK
  errors 依赖）。
- 版本策略：Changesets fixed 组，minor 联动发布（无冻结期，见
  architecture-v2 §6）。

## 后果

**收益**：铁律 2 可被 grep/CI 机械校验；三处格式探测归一；Dexie 从
runtime 依赖树下沉；Node/SSR 降级策略集中在一处；测试 fake 统一。

**代价**：新增一个发布包（fixed 组自动联动）；一层间接调用（纯函数
透传，无运行时开销）；存量测试注入口需小幅适配（A4 内消化）。

**技术债**：CI 架构守卫当前为 shell grep + sed 近似分析（`scripts/check-browser-api.sh`），
无法处理模板字面量嵌套、多行字符串等边界。待项目引入自定义 ESLint 插件基础设施后，
应迁移为 AST 级 `no-restricted-globals` / `no-restricted-syntax` 规则（精确、零误报）。

**不做的事**：不强推全面 DI 容器；不迁移 Presentation 层 DOM 操作；
不在本期实现 FilePickerAdapter。
