---
editUrl: false
next: false
prev: false
title: "RunOptions"
---

Defined in: [runtime/src/types.ts:91](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L91)

`run()` 选项。

- `appendHistory`:为 true 时,同一工作流 ID 的后续 run() 在已有历史栈上
  追加条目(支持跨次 undo/redo 链,如 playground HistoryDemo 的连续滤镜)。
  默认 false —— 每次 run() 重置历史栈,与"重新执行"语义一致。

## Properties

### appendHistory?

> `optional` **appendHistory?**: `boolean`

Defined in: [runtime/src/types.ts:92](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/types.ts#L92)
