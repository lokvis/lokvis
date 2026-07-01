---
title: Workflows
description: A workflow is a linear chain of transform nodes. Year 1 supports linear chains only.
draft: false
head: []
---

# Workflows

A workflow is a directed acyclic graph of `transform` nodes. In Year 1, only linear chains are supported.

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

## Executing a Workflow

```typescript
const assetId = await lokvis.importAsset({ kind: 'file', file });
const result = await lokvis.run(workflow, [assetId]);

console.log(result.status);   // 'completed' | 'failed' | 'cancelled'
console.log(result.outputs);  // AssetId[]
console.log(result.duration); // ms
```

## Year 1 Constraints

- Linear only — no branches, loops, conditions, or parallelism
- Single input type per workflow
- Workflow nodes are transform nodes (load/export are implicit)
