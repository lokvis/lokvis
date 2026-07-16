# 工作流系统（Workflows）

> Workflow 是有向无环图（DAG）的 `transform` 节点集合。Year 1 仅支持线性链。

---

## Schema

```json
{
  "id": "wf_abc123",
  "name": "Compress for Web",
  "version": "1",
  "description": "Resize and compress image for web",
  "author": { "id": "local", "name": "Local User" },
  "category": "image",
  "tags": ["web", "compress"],
  "nodes": [
    {
      "id": "n1",
      "type": "transform",
      "capability": "image.resize",
      "params": { "width": 1920, "fit": "inside" }
    },
    {
      "id": "n2",
      "type": "transform",
      "capability": "image.compress",
      "params": { "format": "webp", "quality": 80 }
    }
  ],
  "edges": [
    { "from": "n1", "to": "n2" }
  ],
  "inputs": { "type": "image", "multiple": true },
  "outputs": { "type": "image" }
}
```

### Schema 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 唯一标识，`wf_` 前缀 |
| `name` | string | ✅ | 工作流名称 |
| `version` | string | ✅ | 版本号 |
| `description` | string | — | 描述 |
| `author` | object | — | 作者信息 |
| `category` | string | — | 分类（image/video/pdf/audio） |
| `tags` | string[] | — | 标签 |
| `nodes` | Node[] | ✅ | 节点列表 |
| `edges` | Edge[] | ✅ | 边列表（定义节点连接） |
| `inputs` | object | ✅ | 输入类型定义 |
| `outputs` | object | ✅ | 输出类型定义 |

### Node 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 节点 ID |
| `type` | string | 节点类型（目前仅 `transform`） |
| `capability` | string | 对应的 capability 名 |
| `params` | object | 参数（Zod schema 校验） |

---

## 执行流程

```typescript
const assetId = await lokvis.importAsset({ kind: 'file', file });
const result = await lokvis.run(workflow, [assetId]);

console.log(result.status);   // 'completed' | 'failed' | 'cancelled'
console.log(result.outputs);  // AssetId[]
console.log(result.duration); // ms
```

### 执行细节

1. **校验**：Workflow 节点顺序、capability 兼容性
2. **导入**：输入资产进入 AssetStore
3. **串行执行**：按 edges 定义的顺序执行每个 transform 节点
4. **中间传递**：每个节点的输出自动作为下一节点的输入
5. **历史记录**：每个节点完成后发出 `node:finished` 事件，自动记录 HistoryStack
6. **返回**：`WorkflowResult` 包含状态、输出 AssetId 列表、耗时

---

## WorkflowBuilder

编程式构建工作流：

```typescript
import { WorkflowBuilder } from '@lokvis/workflow';

const builder = new WorkflowBuilder({ id: 'wf_001', name: 'Web 优化' })
  .setInput({ type: 'image', multiple: true })
  .setOutput({ type: 'image', format: 'webp' })
  .add('image.resize', { width: 1920, fit: 'inside' })
  .add('image.compress', { format: 'webp', quality: 80 })
  .add('image.watermark', { text: '© 2026', position: 'bottom-right' });

const workflow = builder.build();
```

构造参数 `WorkflowBuilderOptions`：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✓ | 工作流 ID（需全局唯一，用作节点 id 前缀） |
| `name` | string | ✓ | 工作流名称 |
| `description` | string | — | 工作流描述 |
| `author` | `WorkflowAuthor` | — | 作者信息（默认本地用户） |
| `category` | `WorkflowCategory` | — | 分类（默认 `'image'`） |
| `tags` | string[] | — | 标签 |
| `official` | boolean | — | 是否为官方工作流 |
| `maxSteps` | number | — | 最大节点数（默认 `MAX_WORKFLOW_STEPS = 5`，测试或特殊场景可放宽） |

`setInput` / `setOutput` 必填，`build()` 在未设置时抛错。

> **架构约束**：`WorkflowBuilder` 与 `buildLinearWorkflow` 位于独立的 `@lokvis/workflow` 包,仅依赖 `@lokvis/schema`。Runtime 层不依赖 workflow 包（[AGENTS.md](../AGENTS.md) 五层单向依赖:UI → Workflow → Runtime → Capability → Engine）。

最多 5 步（`MAX_WORKFLOW_STEPS` 常量，Year 1 限制）。`add()` 超过上限时立即抛错。

---

## 内置工作流模板

| 模板 | 节点 | 说明 |
|------|------|------|
| Web 优化 | resize → compress → convert(WebP) | 网站图片优化 |
| 社媒批量 | resize(preset) → watermark | 社交媒体批量处理 |
| 电商主图 | resize(2048×2048) → compress → background(white) | 电商商品图 |
| 打印预处理 | resize(DPI:300) → convert(TIFF) | 印刷预处理 |
| 截图压缩 | compress(target:100KB) → convert(WebP) | 文档截图压缩 |

---

## 导入/导出

```typescript
// 导出为 JSON
const json = JSON.stringify(workflow, null, 2);

// 导入
const imported = JSON.parse(json);
const result = await lokvis.run(imported, [assetId]);
```

---

## AI 指令导出（Phase 2）

Workflow 可导出为 AI 可理解的指令格式：

```typescript
import { workflowToAiInstruction } from '@lokvis/schema';

const instruction = workflowToAiInstruction(workflow);
// {
//   instruction: "Execute 2-step workflow: image.resize → image.compress",
//   capabilities: ["image.resize", "image.compress"],
//   inputSchema: { ... },
//   example: { input: { input_path: "/path/to/file" }, expectedOutput: "..." }
// }
```

---

## Year 1 约束

| 约束 | 说明 |
|------|------|
| 线性 only | 不支持分支、循环、条件、并行 |
| 单一输入类型 | 每个 workflow 只接受一种输入类型 |
| 隐式 load/export | 导入/导出节点不需要显式声明 |
| 最多 5 步 | 免费用户 5 个工作流槽位 |

### 未来演进

- **Year 2**：分支（DAG）、并行执行
- **Year 3**：条件节点、循环、子工作流

---

*本文档整合自 `apps/docs/src/content/docs/workflows.md` 与 AI 生态冲击调整方案 §7.2。*
