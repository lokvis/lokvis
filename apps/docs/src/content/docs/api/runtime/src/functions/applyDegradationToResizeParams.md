---
editUrl: false
next: false
prev: false
title: "applyDegradationToResizeParams"
---

> **applyDegradationToResizeParams**(`params`, `decision`): `Record`\<`string`, `unknown`\>

Defined in: [runtime/src/degradation.ts:221](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/degradation.ts#L221)

把降级决策应用到 resize 参数(若 L3):确保输出最大边不超过 maxEdge。

调用方在 L3 时据此调整 params.width/height,再交给 engine.resize。
L1/L2/L4 时原样返回 params。

## Parameters

### params

`Record`\<`string`, `unknown`\>

### decision

[`DegradationDecision`](/docs/api/runtime/src/interfaces/degradationdecision/)

## Returns

`Record`\<`string`, `unknown`\>
