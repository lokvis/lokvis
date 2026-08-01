# 技术架构设计

> 本文档整合了 Starlight 文档站架构页与白皮书 04《技术架构设计》的核心内容。
> 如需查看 Mermaid 交互图表，请参阅 [Starlight 文档站 - Architecture](../apps/docs/src/content/docs/architecture.mdx)。

---

## 一、六层架构总览

Lokvis 遵循严格的六层架构，依赖方向**单向向下**。

```
┌─────────────────────────────────────────────────┐
│ 6. UI Layer                                     │
│    Astro 7 + React 19 + Tailwind v4             │
├─────────────────────────────────────────────────┤
│ 5. Workflow Layer                               │
│    线性工作流执行器（Year 1）                      │
├─────────────────────────────────────────────────┤
│ 4. Runtime Layer                                │
│    浏览器操作系统：Input → Run → Output           │
├─────────────────────────────────────────────────┤
│ 3. Capability Layer                             │
│    <domain>.<action> 命名规范                    │
├─────────────────────────────────────────────────┤
│ 2. Engine Layer                                 │
│    可插拔引擎：Canvas / Squoosh / ffmpeg.wasm    │
├─────────────────────────────────────────────────┤
│ 1. Browser Adapter Layer                        │
│    Canvas/OPFS/IDB/Workers 统一抽象              │
│    （唯一允许触碰原生浏览器 API 的层）            │
└─────────────────────────────────────────────────┘
```

### 各层职责

| 层级 | 职责 | 技术栈 |
|------|------|--------|
| **UI Layer** | 渲染 Workspace UI 和工具页面 | Astro 7、React 19、Tailwind v4、Zustand |
| **Workflow Layer** | 线性工作流执行器，每个 workflow 是 `transform` 节点的链式连接 | `WorkflowBuilder`、`@lokvis/schema` |
| **Runtime Layer** | "浏览器操作系统"，管理 assets、capabilities、history、event bus。不感知 React | `@lokvis/runtime`、IndexedDB、OPFS |
| **Capability Layer** | `<domain>.<action>` 标准化能力抽象。Runtime 只知 capability，不知 FFmpeg | `@lokvis/capability` |
| **Engine Layer** | 可插拔适配器，包装 WASM 库。MVP 图像引擎使用原生 Canvas + createImageBitmap | `@lokvis/engine-*` |
| **Browser Adapter Layer** | 原生浏览器 API 的统一抽象（EnvProbe / CanvasFactory / MediaProbe / StorageAdapter / KVStoreFactory / WorkerFactory / FormatSupportProbe）。**唯一允许触碰 `navigator.` / `document.` / `window.` / `indexedDB` / canvas 的非展示层**；runtime/workflow/capability/plugin/sdk 一律经此注入 | `@lokvis/browser-adapter` |

### 依赖规则

- `lokvis-open` 永远不导入 `lokvis-cloud`
- Runtime 永远不感知 React / Redux
- Schema 永远不感知 Runtime
- Plugin 永远不感知 Cloud
- runtime / workflow / capability / plugin / sdk 禁止直接触碰原生浏览器 API，必须经 `@lokvis/browser-adapter`（ADR-015）

### 双注册表:引擎选择 vs 能力实现选择(ADR-016)

仓内存在两个"注册表"契约,职责边界如下:

| | EngineRegistry(`@lokvis/engine-core`) | CapabilityRegistry(`@lokvis/runtime`) |
|---|---|---|
| 选择粒度 | 每**媒体类型**选一个引擎 | 每**能力**(`<domain>.<action>`)选一个实现 |
| 判据 | 运行时 `isSupported()` 环境探测,首个支持者胜出 | 构建期元数据:`status` 过滤 stub → `preferredEngine` → 策略(`first` / `fastest` / `balanced`,`fastest` 按 `PerformanceLevel` fast<medium<slow 排序) |
| 时机 | 异步(`selectBest()`) | 同步(`resolve(name, preferredEngine?)`) |
| 现状 | **预留契约,0 消费方**——全部引擎已收敛为"纯函数 + 描述符常量"(ADR-016) | Runtime 执行链唯一生效的选择机制 |

依赖关系与数据流(engine 不感知 runtime,注册由 plugin 层单向完成):

```
  @lokvis/engine-*                @lokvis/plugin-*                 @lokvis/runtime
┌───────────────────┐   import  ┌────────────────────────┐  ctx   ┌──────────────────────┐
│ 纯函数 operations  │──────────▶│ 读描述符推导 isStub      │───────▶│ CapabilityRegistry    │
│ XXX_ENGINE 描述符  │           │ plugin-sdk 工厂包装      │register│  registerCapability   │
│ { name, version,  │           │ status: stub / stable   │        │  registerImplementation│
│   supportedCaps? }│           └────────────────────────┘        │  resolve(name) ──▶ 执行 │
└───────────────────┘                                             └──────────────────────┘
        │
        └─ EngineAdapter / EngineRegistry(engine-core):预留给
           "同媒体类型 ≥2 实现且需运行时环境探测切换"的场景
           (如未来 image 的 canvas vs Squoosh),当前无消费方。
```

引擎级 stub 约定:描述符 `version.includes('stub')` 为唯一判据;能力级豁免
(plugin-pdf `REAL_STUB_CAPABILITIES`、plugin-ai cloud-proxy `!cloudCaller`)
详见 [ADR-016](adr/016-engine-contract-ruling.md)。

---

## 二、存储架构

### 资产存储策略

Runtime 只操作 `AssetId`，不直接持有 Blob。资产存储由 `createAssetStore()` 工厂按优先级自动探测最佳后端：

```
OPFS（最优，支持 FileSystemSyncAccessHandle）
  → IndexedDB（Dexie，持久化降级）
    → 内存（最终降级，不持久化）
```

每个后端用 `BlobHandle.path` 前缀区分：`opfs://` / `idb://` / `memory://`。

### 元数据存储

- 元数据：IndexedDB（via Dexie）
- 大文件：OPFS（Origin Private File System）

### 配额校验

Runtime 在 `run()` 前执行 `checkStorageQuota()`，超限抛 `QuotaExceededError`。

---

## 三、Worker 隔离

所有重计算（图像编解码、未来 WASM 引擎）运行在独立 **Web Worker** 内，与主线程 UI 解耦，避免长任务阻塞渲染。

跨域隔离（COOP/COEP）在部署端配置（open 侧由 `apps/playground` 托管平台设定；cloud 侧由 `lokvis-cloud` 仓的部署配置设定），启用 `SharedArrayBuffer` 供多线程 WASM 使用。

### 通信协议（`@lokvis/runtime` worker-protocol）

纯 JSON 消息，按流向分两组：

- **Host → Worker**：`request`（带 id 的方法调用）、`ping`（心跳）
- **Worker → Host**：`response`（按 id 关联）、`pong`、`event`（进度等）、`ready`（握手）、`error`（致命错误）

Worker 启动后主动发 `ready`（携带协议版本），Host 校验版本后才开始发送请求。

**协议版本号**：`WORKER_PROTOCOL_VERSION = '0.1.0'`

**默认参数**：
| 参数 | 默认值 | 说明 |
|------|--------|------|
| heartbeat | 5s | Host 周期性 ping 间隔 |
| timeout | 15s | Worker 必须在超时内 pong |
| request timeout | 60s | 每请求独立超时 |
| maxRestarts | 3 | 最大重启次数 |
| ready timeout | 10s | 握手超时 |

### Host 管理（WorkerHost）

- **Request/Response**：每个请求唯一 id，响应按 id 关联
- **心跳与超时**：Host 周期性 `ping`，Worker 必须在超时内 `pong`，否则视为崩溃
- **崩溃重启**：传输层 error / 心跳超时 → 终止当前 Worker → 拒绝所有 pending → 重建新 Worker（最多 `maxRestarts` 次）。超过上限进入 `dead`，交由上层降级
- **传输层抽象**：`WorkerTransport` 接口屏蔽浏览器 Worker / 测试 Fake 差异

**WorkerHost 状态机**：

```
idle → ready → restarting → dead/disposed
```

### Engine in Worker（`@lokvis/engine-image` worker-adapter）

图像操作在 Worker 内基于 `OffscreenCanvas` + `createImageBitmap` 渲染。Worker 入口调用 `startImageWorker()` 完成 ready 握手、ping→pong、request→response 接线。

### AVIF WASM 编码器私有 Worker（`@lokvis/engine-image` wasm/）

AVIF 的 wasm 兜底编码使用**独立的私有 Worker**（`wasm/avif-worker.ts`），与上文 WorkerHost 管理的通用图像 Worker **互不复用**：

- **与 WorkerHost 的关系**：通用图像 Worker 由 `WorkerHost` 管理，但当前处于 **dormant** 状态——`plugin-image` 在主线程直调 canvas 引擎（`WorkerHost` 基建已铺设但未启用）。AVIF 私有 Worker 不经过 `WorkerHost`，而是 `wasm/avif-encoder.ts` 内的**模块级单例**，仅在「原生 avif 编码不可用 + wasm 兜底启用」时由 `encodeSmart` 按需创建。
- **为何独立**：libavif codec 实例化较重（wasm ~0.4s），单例复用避免重复初始化；且编码是单次同步 wasm 调用，与通用图像 Worker 的 OffscreenCanvas 渲染职责正交，隔离可避免相互阻塞。
- **通信协议**：精简的 `request`/`response`（按数字 id 多路复用同一 worker），**无** ping/pong 心跳、**无** progress 事件——libavif 编码无进度/中断钩子（设计文档 D5）。
- **取消语义**：abort = host 侧 `terminate()` 当前 worker 并拒绝所有 in-flight 请求（含发起方，统一 AbortError），下一次编码自动重建单例。因编码不可中途打断，terminate 是唯一可行的取消手段。
- **崩溃重建**：worker `error` 事件（wasm 加载失败 / OOM）→ 拒绝所有 pending → 清空单例 → 下次编码自动重建。
- **wasm 加载**：worker 是独立 realm，读不到主线程配置，host 把解析好的版本化 wasm URL 随消息传入；worker 内 `fetch` + `wasmBinary` 注入实例化单线程胶水（D6 强制单线程，避免 emscripten 嵌套子 worker）。

---

## 四、历史栈与 undo/redo（HistoryStack）

每个工作流拥有独立的 `HistoryStack`，记录每一步 transform 的 `HistoryEntry`。

### 核心机制

- **游标模式**：cursor 指向最后一条已应用的 entry
- **append**：新操作时截断 cursor 之后的 redo 分支
- **LRU 淘汰**：超出上限（默认 10 步）时淘汰最旧条目，回调 `onEvict` 通知清理 OPFS 资产
- **事件驱动**：每次变更通过 eventBus 发出 `history:changed` 事件
- **自动记录**：Runtime 监听 `node:finished` 事件自动 append 历史

### API

- `undo()` → 返回上一步的 Asset，回到初始输入时返回 `null`
- `redo()` → 重新应用被撤销的操作
- `jumpTo(index)` → 跳转到指定步骤
- `clear()` → 清空历史
- `snapshot()` → 历史快照

---

## 五、Runtime 核心流程

### `run()` 执行流程

1. 校验 `storageQuota`
2. 导入输入资产
3. **`validateWorkflow`**：校验 workflow 节点顺序、capability 兼容性、`MAX_WORKFLOW_STEPS` 上限、capability resolve（runtime `WorkflowCoordinator.run` 起手第一步）
4. `historyManager.prepareForRun`：初始化历史栈与初始输入记录
5. 按 Workflow 节点顺序执行 transform（经 `Executor.execute`）
6. 每个节点完成后发出 `node:finished` 事件，`HistoryManager` 自动 append HistoryStack
7. `historyManager.recordRunResult`：记录运行结果
8. 返回 `WorkflowResult`（status / outputs / duration）

### 能力降级阶梯

| 级别 | 行为 |
|------|------|
| L1 | 完整处理 |
| L2 | 分片处理（大文件 >500MB） |
| L3 | 降级输出（降低质量） |
| L4 | 拒绝 + 引导用户 |

### 内存防御

- 内存阈值监测：超 512MB 中间结果落 OPFS
- `ReadableStream → WritableStream` 接口规范
- `cancel()` 通过 AbortController 贯穿 Worker

---

## 六、事件总线（Event Bus）

Runtime 通过事件总线解耦各模块通信。主要事件：

| 事件 | 触发时机 |
|------|----------|
| `node:finished` | 每个 transform 节点完成 |
| `history:changed` | 历史栈变更 |
| `batch:progress` | 批量处理进度 |
| `batch:completed` | 批量处理完成 |

---

## 七、Open Core 模式

```
lokvis-open（Apache-2.0）                    lokvis-cloud（闭源）
├── Runtime                           ├── API
├── Schema                            ├── Marketplace
├── Plugins（官方）                    ├── Dashboard
├── SDK                               ├── Billing
├── CLI                               ├── Sync
├── MCP Server                        ├── AI
└── 官方 UI（Workspace）               └── Cloud Pro
```

`lokvis-open` 提供 runtime、schema、plugins 和官方 UI。`lokvis-cloud` 添加商业服务。

### 三仓关系（架构 v2 基线）

Lokvis 平台按 Release Unit 划分为三个仓库，本仓（`lokvis-open`）回答 "How"，承担六层中的 L2 Runtime 与 L1 Browser Adapter：

```
lokvis/（GitHub org）
├── lokvis-open        回答 How（本仓）
│                      Runtime · Browser Adapter · Workflow Engine ·
│                      Capability Registry · Plugin SDK · CLI · MCP · Playground
├── lokvis-knowledge   回答 What do we know（CC BY 4.0）
│                      Formats · Platforms · Compatibility · Benchmarks ·
│                      Taxonomy · References（仅 machine-consumable 结构化数据）
└── lokvis-cloud       回答 What should user do（闭源）
                       Astro 站 · Planner · Workspace · Explorer · Search · SEO
```

依赖方向（单向，不可逆）：

```
lokvis-cloud ──npm──► @lokvis/*        （lokvis-open 发布的运行时包）
lokvis-cloud ──npm──► @lokvis/data-*   （lokvis-knowledge 发布的数据包）
lokvis-open  ──npm──► @lokvis/data-*   （可选，如 capability 默认参数）
lokvis-open  ──✕──►  cloud             （永不依赖；cloud-bridge 注入模式隔离）
lokvis-knowledge ──✕──► 任何仓          （零代码依赖，纯数据）
```

完整最终态定义（五层平台分层、铁律、已裁决事项）见根目录基线文档
[`docs/architecture-v2.md`](../../docs/architecture-v2.md)（位于 org 级 docs，本仓引用其结论）。

---

## 八、仓库基线（2026-07-15 快照）

| 模块 | 状态 | 说明 |
|------|------|------|
| `packages/schema` | ✅ 已实现 | Workflow/Asset/Capability/Plugin/Event Zod schema + 校验器 + 单测 + MAX_WORKFLOW_STEPS 等业务约束常量 |
| `packages/runtime` | ✅ 已实现 | 调度/事件总线/AssetStore/CapabilityRegistry/undo/redo/OPFS 已实现;**已二次分层**（runtime.ts 22 行 Facade + 5 个 manager);无 streaming |
| `packages/capability` | ✅ 已实现 | names/helpers/presets + 单测;**manifest codegen 已落地**（5 域 manifest + 5 个 .generated.ts） |
| `packages/workflow` | ✅ 已实现 | 独立包,仅依赖 `@lokvis/schema`,提供 `WorkflowBuilder` 与 `buildLinearWorkflow` |
| `packages/sdk` | ✅ 已实现 | createLokvis/loadPlugin + PluginContext + toMcpManifest + auth-pro 软耦合 |
| `packages/plugin-sdk` | ✅ 已实现 | definePlugin/PluginContext 类型 + 三个工厂（createBlobCapabilityImpl/createMergeCapabilityImpl/createSplitCapabilityImpl） |
| `packages/engine-image` | ✅ 已实现 | Canvas + createImageBitmap,零 WASM,9 能力;**多导出**(主入口浏览器 canvas 引擎 + `./node` 子路径 sharp 引擎,5 能力 resize/compress/convert/crop/watermark,问题 B 合并) |
| `packages/plugin-image` | ✅ 已实现 | 9 能力,接 canvas engine（浏览器）+ sharp engine（Node 子路径 `@lokvis/plugin-image/node`）+ 单测 |
| `packages/plugin-pdf` | 🟡 stub | 接 engine-pdf stub,7 能力声明 |
| `packages/plugin-video` | 🟡 stub | 接 engine-video stub,7 能力声明 |
| `packages/plugin-audio` | 🟡 stub | 接 engine-audio stub,4 能力声明 |
| `packages/plugin-ai` | 🟡 stub | 接 engine-ai stub,5 能力声明（ocr/caption/bg-remove 走 transformersEngine,generate/optimize-workflow 走 cloudProxyEngine） |
| `packages/plugin-dev` | ✅ 已实现 | 4 能力（inspect.capabilities/inspect.asset/validate.workflow/profile）,内联实现 |
| `packages/engine-pdf` | 🔴 stub | 接口完整,7 操作抛 Not Implemented |
| `packages/engine-video` | 🔴 stub | ffmpeg.wasm/webcodecs 占位,8 操作抛 Not Implemented（decode/transcode/compress/trim/screenshot/merge/extractAudio/toGif） |
| `packages/engine-audio` | 🔴 stub | 空壳,4 操作抛 Not Implemented |
| `packages/engine-ai` | 🔴 stub | 空壳,5 操作抛 Not Implemented |
| `packages/mcp-server` | ✅ 已实装 | `createLokvisMcpServer()` 返回真实 McpServerAdapter;stdio/SSE/WebSocket 三传输;5 个 tool（3 image + 2 pdf）真实可用;auth/billing 经 `@lokvis/cloud-bridge` 注入（含降级） |
| `packages/cloud-bridge` | ✅ 已实装 | cloud 鉴权(McpAuthenticator)与计费(McpBilling);CloudConfig env 覆盖(apiBaseUrl/upgradeUrl/planQuotas/pricePerCallCents);mcp-server 可注入依赖 |
| `packages/cli` | ✅ 已实现 | `run`/`capabilities`/`plugin create`/`version`/`help` 命令;Node 环境用 `@lokvis/plugin-image/node` |
| `packages/ui-react` | ✅ 已实现 | Workspace UI + Zustand store + 8 hooks;ToolRunner engine 经 prop 注入 |
| `packages/ui-core` | ✅ 已实现 | 15 个设计系统组件（badge/button/card/dialog/input/select/slider/spinner/tabs/textarea/toggle/tooltip/icon/confirm-dialog/empty-state） |
| `apps/docs` | 🟢 Starlight | 10 页内容 + 16 Mermaid 图表（architecture.mdx 9 + runtime/engine/plugin/capability/mcp 7） |
| `apps/playground` | ✅ 已落地 | 8 demo + PWA 组件 + 65 单测（snippets 14 + share 16 + download 9 + sentry 26） |

---

## 九、技术栈演进

```
Phase 1（2026 H2）
├── Astro 7 + React 19 + Tailwind v4
├── Zustand
├── Canvas + createImageBitmap（零 WASM）
├── Dexie（IndexedDB）+ OPFS
└── Cloudflare Workers + R2 + D1

Phase 2（2027 H1）
├── + pdf-lib
├── + ffmpeg.wasm
├── + tesseract.js
├── + sharp（Node.js 降级引擎）
└── + @modelcontextprotocol/sdk

Phase 3（2027 H2 - 2028 H1）
├── + onnxruntime-web（本地 AI）
├── + Whisper.cpp
└── + LLM API 集成

Phase 4（2028 H2 - 2029 H1）
├── + Tauri（桌面打包）
├── + sql.js
└── + 公共 API 网关
```

---

*本文档整合自 `apps/docs/src/content/docs/architecture.mdx` 与 `docs/business/04-技术架构设计.md`。*
