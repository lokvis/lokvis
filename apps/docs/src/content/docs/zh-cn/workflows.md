---
title: 工作流
description: 工作流是由 transform 节点组成的线性链。Year 1 仅支持线性链。
draft: false
head: []
---

# 工作流(Workflows)

工作流是由 `transform` 节点构成的有向无环图。Year 1 仅支持线性链。

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
    { "id": "n1", "type": "transform", "capability": "image.resize", "params": { "width": 1920, "fit": "inside" } },
    { "id": "n2", "type": "transform", "capability": "image.compress", "params": { "format": "webp", "quality": 80 } }
  ],
  "edges": [
    { "from": "n1", "to": "n2" }
  ],
  "inputs": { "type": "image", "multiple": true },
  "outputs": { "type": "image" }
}
```

## 执行工作流

```typescript
const assetId = await lokvis.importAsset({ kind: 'file', file });
const result = await lokvis.run(workflow, [assetId]);

console.log(result.status);   // 'completed' | 'failed' | 'cancelled'
console.log(result.outputs);  // AssetId[]
console.log(result.duration); // ms
```

## Year 1 约束

- 仅线性——无分支、循环、条件或并行
- 每个 workflow 单一输入类型
- workflow 节点均为 transform 节点(load / export 为隐式)
