---
editUrl: false
next: false
prev: false
title: "pickDegradation"
---

> **pickDegradation**(`ctx`): [`DegradationDecision`](/docs/api/runtime/src/interfaces/degradationdecision/)

Defined in: [runtime/src/degradation.ts:92](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L92)

根据内存压力与操作能力选择降级策略(纯函数)。

决策矩阵:
  pressure  canTile  canSpill  →  level
  low/elevated  *        *     →  L1-full
  high          true    true   →  L2-tiled(spill)
  high          true    false  →  L2-tiled(无 spill,仅靠 tile 控峰值)
  high          false   *      →  L3-degraded(降到 maxEdge+quality)
  critical      *       *      →  L3-degraded(若 decodedBytes 缩放后仍超
                                             critical → L4-reject)

L4 触发条件:pressure=critical 且 decodedBytes 已按 maxEdge 缩放后
估算仍 >= budget 的 critical 阈值(0.95),即"再怎么缩也会撑爆"。

**调用方注意**:当 pressure=critical 且 canSpill=true 时,若不提供
decodedBytes,函数将跳过 L4 判定直接返回 L3-degraded。这意味着对于
超大单张图(无法通过 spill 分块),L3 缩放后仍可能 OOM。
建议:尽可能通过 estimateDecodedBytes(width, height) 提供 decodedBytes,
以提高 L4 判定精度,避免静默降级后崩溃。

## Parameters

### ctx

[`DegradationContext`](/docs/api/runtime/src/interfaces/degradationcontext/)

## Returns

[`DegradationDecision`](/docs/api/runtime/src/interfaces/degradationdecision/)
