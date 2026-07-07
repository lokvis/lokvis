---
title: 工作流
description: 工作流是 transform 节点的线性链。第一年仅支持线性链。
draft: false
head: []
---

# 工作流

工作流是由 `transform` 节点组成的有向无环图。第一年仅支持线性链。

## 数据结构

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

## 第一年限制

- 仅限线性 —— 不支持分支、循环、条件或并行
- 每个工作流单一输入类型
- 工作流节点均为 transform 节点(加载/导出为隐式)
