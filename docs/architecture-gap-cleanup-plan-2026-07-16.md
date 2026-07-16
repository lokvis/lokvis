# 架构 Gap 与 Workaround 治理计划（2026-07-16）

> 基于全面审计（10 份文档 + 23 个 packages + apps/docs + apps/playground）形成的执行计划。
> 覆盖 6 个关键决策（A-F）+ Tier 1 文档同步 + 其他清理项。
> 每项任务单独 commit、push，逐项推进。

## 总览

| ID | 任务 | 类型 | 影响面 |
|---|---|---|---|
| T1.1 | 修正 sdk-reference.md Runtime API 契约 | 文档同步 | 消费方写代码会错 |
| T1.2 | 修正 workflows.md WorkflowBuilder 示例 | 文档同步 | 示例无法编译 |
| T1.3 | 修正 capabilities.md 能力清单 | 文档同步 | 漏 image.filter / 多 audio.denoise |
| T1.4 | 修正 plugins.md 官方插件表 | 文档同步 | 漏 plugin-audio / plugin-ai |
| T1.5 | 同步 TASKS.md 与 technical-debt.md 债务数 | 文档同步 | 债务数与代码不一致 |
| T2.6 | 同步 architecture.md §8 数字 | 文档同步 | 5 处数字偏差 |
| **A** | 抽取 `@lokvis/cloud-bridge` 独立包 | 架构去耦合 | cloud 耦合泄漏（TD-1.5） |
| **B** | engine-image-node 合入 engine-image 多导出 | 架构去耦合 | 类型双源维护 |
| **C** | developer.* 纳入 codegen | 架构一致性 | 注释与现状脱节 |
| **D** | SDK 侧补 AssetBlobNotFoundError 公共类 | 错误契约一致性 | 1:1 对应契约破坏 |
| **E** | engine-audio.merge 补 params 参数 | 接口统一 | 与其他 engine merge 不一致 |
| **F** | 移除 4 处冗余依赖声明 | 清理 | 无功能影响 |

## 执行顺序

按"阻塞 → 文档 → 架构"分档推进：

```
T1.1 → T1.2 → T1.3 → T1.4 → T1.5 → T2.6
                                            ↓
                                            E → C → F → B → D → A
```

- T1.x：文档同步（无依赖，按顺序串行）
- E/C/F：小 cleanup（无外部依赖）
- B/D/A：架构调整（B 在前，D 在中间，A 在最后）

---

## T1.1 修正 sdk-reference.md Runtime API 契约

**问题**：sdk-reference.md Runtime API 表与 [runtime/src/types.ts](../packages/runtime/src/types.ts) `LokvisRuntime` 接口严重不符。

**修复点**：

1. **移除** `getAssetBlob(asset)` — 公共 Runtime 上无此方法；仅 `PluginContext.runtime`（[plugin-context.ts:64](../packages/runtime/src/plugin-context.ts)）存在，标注"仅 plugin 内部可用"
2. **修正** `undo()` → `undo(workflowId: string): Promise<void>`（原文档 `Promise<AssetId|null>` 无参）
3. **修正** `redo()` → `redo(workflowId: string): Promise<void>`
4. **修正** `jumpTo(workflowId, stepId)` → `jumpTo(workflowId: string, index: number): Promise<void>`
5. **修正** `history` 同步属性 → `history(workflowId: string): Promise<HistoryEntry[]>` 异步方法
6. **修正** `getHistoryState` → 返回 `Promise<{ entries, cursor }>`（async）
7. **修正** `hasCapability` / `isStubOnly` / `getStorageUsage` → 均为 `Promise<...>`（async）
8. **修正** 错误 code `WORKER_HANDSHAKE` → `WORKER_HANDSHAKE_FAILED`
9. **补列** `version` / `status` / `isPro` / `batch` / `getCurrentOutputs` / `installPlugin`

**验收**：所有文档 API 在 types.ts 接口存在；所有接口方法在文档有对应行。

---

## T1.2 修正 workflows.md WorkflowBuilder 示例

**问题**：[workflows.md:96-101](workflows.md) 示例用 `new WorkflowBuilder()` 无参构造，但 [workflow-builder.ts:86-91](../packages/workflow/src/workflow-builder.ts) 要求 `id` + `name` 必填；build() 前必须 setInput + setOutput。

**修复**：

```typescript
const builder = new WorkflowBuilder({ id: 'wf_001', name: 'Web 优化' })
  .setInput({ type: 'image', multiple: true })
  .setOutput({ type: 'image' })
  .add('image.resize', { width: 1920, fit: 'inside' })
  .add('image.compress', { format: 'webp', quality: 80 })
  .add('image.watermark', { text: '© 2026', position: 'bottom-right' });
const workflow = builder.build();
```

**验收**：示例代码可编译运行。

---

## T1.3 修正 capabilities.md 能力清单

**问题**：
- Image 列 8 项，实际 9 项（漏 `image.filter`：grayscale/invert/sepia/blur）
- Audio 列 5 项含 `audio.denoise`，实际 4 项（无 denoise）

**修复**：
1. Image 表加 `image.filter` 一行（preset: grayscale/invert/sepia/blur + radius）
2. Audio 表删除 `audio.denoise` 一行；保留 4 项（trim/merge/transcode/normalize）

**验收**：表内能力数与 [presets/*.generated.ts](../packages/capability/src/presets) 数组长度严格一致。

---

## T1.4 修正 plugins.md 官方插件表

**问题**：[plugins.md:110-115](plugins.md) 表格仅 4 行，遗漏 plugin-audio 与 plugin-ai。

**修复**：补两行：
- plugin-audio | 4 能力 | 🟡 stub（trim/normalize/merge/transcode）
- plugin-ai | 5 能力 | 🟡 stub（ocr/caption/remove-background/generate-workflow/optimize-workflow）

**验收**：表内 6 个插件与 packages/plugin-* 目录一致。

---

## T1.5 同步 TASKS.md 与 technical-debt.md 债务数

**问题**：TASKS.md 技术债务表整体过时（pre-Review #4）；technical-debt.md 自身有 2 处内部矛盾。

**修复点**：

1. TASKS.md「静默吞错」行：4 项(3 清偿,1 剩余) → 11 项(0 清偿,11 剩余)（TD-3.1~3.11）
2. TASKS.md「类型层面 workaround」行：4 项 → 1 项（TD-4.2 活动）
3. TASKS.md 新增「Cloud 耦合泄漏」行：1 项（TD-1.5）
4. technical-debt.md 总览「类型层面 0 处」→「1 处（TD-4.2 活动）」
5. technical-debt.md 总览「事件订阅 cleanup 3 处」→「2 处」（与 §6 一致）

**验收**：两份文档自洽，且与代码扫描结果一致。

---

## T2.6 同步 architecture.md §8 数字

**问题**：5 处数字偏差。

| 位置 | 文档 | 实际 |
|---|---|---|
| L221 engine-video | "9 操作" | 8 方法（含 decode） |
| L227 ui-core | "16 个" | 15 个 |
| L228 apps/docs Mermaid | "9" | 16 处 |
| L229 apps/playground 单测 | "30" | 65 个 |

**验收**：所有数字与代码扫描结果一致。

---

## 问题 A：抽取 `@lokvis/cloud-bridge` 独立包

### 背景

[mcp-server/src/auth.ts](../packages/mcp-server/src/auth.ts) 与 [billing.ts](../packages/mcp-server/src/billing.ts) 含 cloud 鉴权与计费逻辑：
- 硬编码 `https://api.lokvis.com`（有 env 覆盖）
- 硬编码 `https://app.lokvis.com/billing`（**无 env 覆盖**）
- 硬编码 `PLAN_AI_QUOTAS` plan 配额表
- 硬编码价格文案 `$0.01/call thereafter`

违反 architecture.md §1.5 "lokvis-open 永远不导入 lokvis-cloud" 精神（已登记 TD-1.5）。

### 决策

把 cloud 鉴权/计费逻辑抽到独立包 `@lokvis/cloud-bridge`，作为 mcp-server 的可注入依赖。

### 实施步骤

1. 新建 `packages/cloud-bridge/`，包含：
   - `src/index.ts`：导出公共 API
   - `src/auth.ts`：从 mcp-server/auth.ts 迁移 `McpAuthenticator` + `AuthenticatedUser` + `isValidApiKeyFormat`
   - `src/billing.ts`：从 mcp-server/billing.ts 迁移 `McpBilling` + `BillingCheckResult` + `EntitlementsResponse`
   - `src/cloud-config.ts`：**新增** `CloudConfig` 接口 + `resolveCloudConfig(env)` 函数
2. `package.json`：依赖 `@lokvis/schema`（无）；peer runtime `node-fetch`（Node 18+ 内置，无需额外依赖）
3. 在 mcp-server：
   - 移除 `src/auth.ts` 与 `src/billing.ts`
   - `src/cli.ts` 与 `src/server.ts` 改为 `import { McpAuthenticator, McpBilling, resolveCloudConfig } from '@lokvis/cloud-bridge'`
   - `createLokvisMcpServer` 新增可选 `cloud?: CloudConfig` 参数
4. env 覆盖路径完整化：
   - `LOKVIS_API_BASE_URL`（已有）
   - `LOKVIS_UPGRADE_URL`（新增，默认 `https://app.lokvis.com/billing`）
   - `LOKVIS_PLAN_QUOTAS_JSON`（新增，JSON 字符串，默认内置表）
   - `LOKVIS_PRICE_PER_CALL_CENTS`（新增，默认 1）

### CloudConfig 接口

```typescript
export interface CloudConfig {
  /** cloud API 地址，默认 'https://api.lokvis.com'，env LOKVIS_API_BASE_URL */
  apiBaseUrl: string;
  /** 充值链接，默认 'https://app.lokvis.com/billing'，env LOKVIS_UPGRADE_URL */
  upgradeUrl: string;
  /** plan 配额表，默认 { free:0, pro:0, cloud_pro:10, enterprise:Infinity }，env LOKVIS_PLAN_QUOTAS_JSON */
  planQuotas: Record<string, number>;
  /** 每次 AI 调用价格（美分），默认 1，env LOKVIS_PRICE_PER_CALL_CENTS */
  pricePerCallCents: number;
  /** 可选 API Key，env LOKVIS_API_KEY */
  apiKey?: string;
}

export function resolveCloudConfig(env: NodeJS.ProcessEnv = process.env): CloudConfig { ... }
```

### 验收

- `grep -r 'api\.lokvis\.com' packages/mcp-server/src/` 仅命中注释（无硬编码值）
- `grep -r 'PLAN_AI_QUOTAS' packages/mcp-server/src/` 0 命中
- env 覆盖测试通过
- 无 API key 时降级行为不变

---

## 问题 B：engine-image-node 合入 engine-image 多导出

### 背景

- [packages/engine-image](../packages/engine-image) 与 [packages/engine-image-node](../packages/engine-image-node) 两个包存在：
  - 类型双源维护（ResizeParams / CompressParams / ConvertParams / CropParams / WatermarkParams 在两包各自定义）
  - 参数字段（如 fit 枚举、quality 范围）若变更需同步两处
- engine-image-node 的 src 完全无 @lokvis/* import，类型自建

### 决策

合并为单一包 `@lokvis/engine-image`，通过 `exports` 字段多导出：

- `@lokvis/engine-image` — 浏览器引擎（Canvas，默认导出）
- `@lokvis/engine-image/node` — Node 引擎（sharp，子路径导出）
- 包内共享 types.ts，**消除双源维护**

### 实施步骤

1. 把 `engine-image-node/src/types.ts` 中与 `engine-image/src/types.ts` 字段一致的部分删除（直接复用 engine-image types.ts）
   - 唯一差异：engine-image ResizeParams 多了 `dpi?` 字段（PNG pHYs 嵌入），engine-image-node 不支持。统一保留 `dpi?` 可选字段，Node 引擎忽略非正数即可。
   - 唯一差异：engine-image WatermarkParams.image 是 data URL，Node 版扩展为 data URL 或 http(s) URL。统一为 `string`（不约束协议），Node 端做 SSRF 校验。
2. 把 `engine-image-node/src/operations/`（resize/compress/convert/crop/watermark + index.ts）+ `sharp-engine.ts` 迁移到 `engine-image/src/node/` 子目录
3. 在 `engine-image/package.json` `exports` 新增子路径：
   ```json
   "./node": {
     "types": "./dist/node/index.d.ts",
     "import": "./dist/node/index.js"
   }
   ```
4. peerDependencies 加 `sharp`（可选，仅在 Node 环境用）
5. 更新 tsconfig 包含 `src/node/**/*`
6. 更新所有引用方：
   - [plugin-image/src/node-plugin.ts:25-31](../packages/plugin-image/src/node-plugin.ts) 从 `@lokvis/engine-image-node` → `@lokvis/engine-image/node`
   - [plugin-image/package.json](../packages/plugin-image/package.json) 依赖 `@lokvis/engine-image-node` → 移除
   - [mcp-server/src/tools/image.ts:19-24](../packages/mcp-server/src/tools/image.ts) 从 `@lokvis/engine-image-node` → `@lokvis/engine-image/node`
   - [mcp-server/package.json](../packages/mcp-server/package.json) 依赖 `@lokvis/engine-image-node` → `@lokvis/engine-image`
   - 修复 `engine-image-node/src/operations/transform.ts:28` / `encode.ts:31` / `watermark.ts:35` 的 `format as any` → `as keyof import('sharp').FormatEnum`（W-4 清偿）
7. 删除 `packages/engine-image-node/`（保留迁移历史在 git）
8. 更新 [architecture.md §8](architecture.md) 的 engine-image-node 行（移除或合并到 engine-image 行）

### 验收

- `packages/engine-image-node/` 目录已删除
- `grep -r '@lokvis/engine-image-node' packages/` 0 命中（含 src / package.json / changesets）
- `pnpm typecheck` 全绿
- `pnpm test` 全绿
- 无 `as any` 在 engine-image/src/node/ 残留

### 注意事项

- 不破坏浏览器构建：`@lokvis/engine-image/node` 子路径在浏览器侧**不会**被引入（plugin-image/node 是单独子路径）
- sharp peerDeps 标为 optional：`"peerDependenciesMeta": { "sharp": { "optional": true } }`

---

## 问题 C：developer.* 纳入 codegen

### 背景

- [packages/capability/src/presets/index.ts:8-12](../packages/capability/src/presets/index.ts) 注释明示"asset/developer 保留手写（无对应 plugin，无 operation entries）"
- 但 [packages/plugin-dev](../packages/plugin-dev) 实际有 operation entries（4 个 capability 全部有真实实现）
- `developer.*` 未进 `BUILTIN_CAPABILITY_NAMES`，导致 `toMcpManifest()` 不会广告 developer 能力
- 注释与现状脱节

### 决策

把 developer.* 纳入 codegen。

### 实施步骤

1. 新建 [packages/capability/manifests/developer.manifest.json](../packages/capability/manifests/developer.manifest.json)：
   - domain: `"developer"`
   - 4 个 capability：inspect.capabilities / inspect.asset / validate.workflow / profile
   - 字段与 [developer.ts](../packages/capability/src/presets/developer.ts) 逐字段对应（含 action 用 `inspect.capabilities` 形式）
2. 运行 `pnpm codegen`：
   - 生成 `packages/schema/src/capability-names.generated.ts`（含 developer.* 字面量）
   - 生成 `packages/capability/src/presets/developer.generated.ts`
3. 删除 [packages/capability/src/presets/developer.ts](../packages/capability/src/presets/developer.ts)
4. 修改 [presets/index.ts](../packages/capability/src/presets/index.ts)：
   - 移除 `export * from './developer.js'`
   - 加 `export * from './developer.generated.js'`
   - 更新注释（移除"developer 保留手写"）
5. 检查 codegen `domainToPrefix`：`developer` 已映射到 `DEV`（见 [codegen-capabilities.ts:105](../scripts/codegen-capabilities.ts)）
6. 检查 action 命名：`inspect.capabilities` → `DEV_INSPECT_CAPABILITIES`（注意：codegen `actionToSuffix('inspect.capabilities')` 会把 `.` 替换为 `_` → `INSPECT_CAPABILITIES`，与现有 const 名一致 ✓）

### 验收

- `BUILTIN_CAPABILITY_NAMES` 含 36 项（32 + 4 developer）
- `developer.generated.ts` 与原 `developer.ts` 字段逐字段对应
- `pnpm typecheck` + `pnpm test` 全绿
- plugin-dev 的 4 个 capability 名（[plugin-dev/src/plugin.ts](../packages/plugin-dev/src/plugin.ts)）与新 codegen 一致

### manifest 内容（参考 developer.ts）

```json
{
  "$schema": "./schema.json",
  "domain": "developer",
  "capabilities": [
    {
      "action": "inspect.capabilities",
      "description": "List all registered capabilities",
      "inputTypes": ["data"],
      "outputTypes": ["data"],
      "params": [],
      "performance": "fast",
      "batchable": false
    },
    {
      "action": "inspect.asset",
      "description": "Inspect asset metadata and structure",
      "inputTypes": ["image", "video", "audio", "pdf", "text", "data"],
      "outputTypes": ["data"],
      "params": [
        {
          "name": "verbose",
          "type": "boolean",
          "default": false,
          "description": "Include full asset detail (tags, history count, timestamps)"
        }
      ],
      "performance": "fast",
      "batchable": true
    },
    {
      "action": "validate.workflow",
      "description": "Validate a workflow without executing it",
      "inputTypes": ["data"],
      "outputTypes": ["data"],
      "params": [],
      "performance": "fast",
      "batchable": false
    },
    {
      "action": "profile",
      "description": "Profile capability execution time",
      "inputTypes": ["image", "video", "audio", "pdf", "text", "data"],
      "outputTypes": ["data"],
      "params": [
        {
          "name": "iterations",
          "type": "number",
          "default": 1,
          "min": 1,
          "description": "Number of profiling iterations per input asset"
        }
      ],
      "performance": "slow",
      "batchable": true
    }
  ]
}
```

---

## 问题 D：SDK 侧补 AssetBlobNotFoundError 公共类

### 背景

- runtime 定义 7 个 typed error（[runtime/src/errors.ts:19-82](../packages/runtime/src/errors.ts)），但 SDK 只导出 6 个公共类
- `AssetBlobNotFoundError` 在 SDK 侧被包装成 `AssetExportError`（code `ASSET_EXPORT_FAILED`）
- 破坏 1:1 对应契约，消费方无法用 `instanceof AssetBlobNotFoundError` 区分"blob 缺失"与"导出失败"

### 决策

在 SDK 侧补 `AssetBlobNotFoundError` 公共类，与 runtime 1:1 对应。

### 实施步骤

1. 在 [sdk/src/errors.ts](../packages/sdk/src/errors.ts) 新增 `AssetBlobNotFoundError` 类（code `ASSET_BLOB_NOT_FOUND`）：
   ```typescript
   export class AssetBlobNotFoundError extends LokvisError {
     constructor(message: string, cause?: unknown) {
       super(message, { code: 'ASSET_BLOB_NOT_FOUND', cause });
       this.name = 'AssetBlobNotFoundError';
     }
   }
   ```
2. `LokvisErrorCode` 联合类型加 `'ASSET_BLOB_NOT_FOUND'`
3. `fromLokvisError` 修改 `RuntimeAssetBlobNotFoundError` 分支：
   ```typescript
   if (value instanceof RuntimeAssetBlobNotFoundError) {
     return new AssetBlobNotFoundError(value.message, value);
   }
   ```
4. [sdk/src/index.ts](../packages/sdk/src/index.ts) 导出列表加 `AssetBlobNotFoundError`
5. [sdk-reference.md](sdk-reference.md) 错误类表加 `AssetBlobNotFoundError | ASSET_BLOB_NOT_FOUND` 行
6. 测试：[sdk/src/__tests__/errors.test.ts](../packages/sdk/src/__tests__/errors.test.ts) 加 `instanceof AssetBlobNotFoundError` 断言

### 验收

- 7 个 runtime typed error 在 SDK 侧各有 1:1 公共类
- `fromLokvisError(RuntimeAssetBlobNotFoundError)` 返回 `AssetBlobNotFoundError` 实例（不再是 `AssetExportError`）
- `pnpm test` 全绿

---

## 问题 E：engine-audio.merge 补 params 参数

### 背景

- [packages/engine-audio/src/index.ts:60](../packages/engine-audio/src/index.ts) `merge(blobs: Blob[])` 无 params
- 与 engine-video/engine-pdf 的 `merge(blobs, params): Promise<Blob>` 不一致
- 当前 mitigation：plugin-audio 包装层用 `(blobs) => webAudioEngine.merge(blobs)` 丢弃 params

### 决策

补 `params: Record<string, any>` 参数，stub 也不影响。

### 实施步骤

1. [engine-audio/src/index.ts](../packages/engine-audio/src/index.ts) 修改两个 stub 引擎的 `merge` 签名：
   - `webAudioEngine.merge(blobs: Blob[], _params: Record<string, any>): Promise<Blob>`
   - `lamejsEngine.merge(blobs: Blob[], _params: Record<string, any>): Promise<Blob>`
   - 方法体不变（仍抛 stub 错）
2. [plugin-audio/src/operations.ts](../packages/plugin-audio/src/operations.ts) 包装层不再丢弃 params：
   - 原：`const mergeOp = (blobs) => webAudioEngine.merge(blobs)`
   - 新：`const mergeOp = (blobs, params, signal) => webAudioEngine.merge(blobs, params, signal)`（与其他 MergeAudioOperation 签名对齐）
3. [engine-audio/src/__tests__](../packages/engine-audio/src/__tests__) stub 测试加 params 透传验证

### 验收

- engine-audio `merge` 签名与其他 engine 一致
- `pnpm typecheck` + `pnpm test` 全绿

---

## 问题 F：移除 4 处冗余依赖声明

### 背景

| 文件 | 声明 | 实际 | 建议 |
|---|---|---|---|
| [engine-core/package.json:33](../packages/engine-core/package.json) | `@lokvis/schema` | src 未导入 | 移除 |
| [engine-image-node/package.json:35](../packages/engine-image-node/package.json) | `@lokvis/schema` | 完全无 @lokvis import | 移除（注：问题 B 完成后此包被删除） |
| [ui-core/package.json:40](../packages/ui-core/package.json) | `@lokvis/schema` | 未导入 | 移除 |
| [cli/package.json:38](../packages/cli/package.json) | `@lokvis/runtime` | 经 sdk 传递使用 | 移除 |

### 决策

按建议执行。注：engine-image-node 的冗余依赖会在问题 B 完成后随包删除一起消失。

### 实施步骤

1. 修改 4 份 package.json，移除冗余 deps
2. `pnpm install` 重新生成 lockfile
3. `pnpm typecheck` + `pnpm build` + `pnpm test` 全绿验证

### 验收

- 4 份 package.json 的 dependencies/devDependencies 中无对应冗余项
- typecheck / build / test 全绿

---

## 已登记但不在本批次处理的事项

以下事项已识别但不在本次治理范围，列入后续阶段：

| ID | 事项 | 阶段 |
|---|---|---|
| T3.1-T3.9 | Phase 2 主线实装（engine-pdf/video/audio 真实实装、mcp Meta Tools/Resources/Prompts、批量持久化） | Phase 2 roadmap |
| T4.1 | 静默吞错统一治理（TD-3.x 11 项） | Sentry 接入后 |
| T4.4 | schema workflow.ts:237 类型重构（TD-4.2） | 长期 |
| T4.5 | UI ObjectURL 生命周期重构（TD-5.1） | 长期 |
| T4.6 | 测试时序依赖治理（TD-2.1/2.2） | 长期 |
| T4.3 | PluginContext API 文档补全（3 项 API） | 长期 |

详见 [docs/technical-debt.md](technical-debt.md)。

---

## 执行日志

每项任务完成后在此追加 commit hash 与验证结果。
