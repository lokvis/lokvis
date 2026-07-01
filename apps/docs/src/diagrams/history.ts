/**
 * History 模块架构图(HistoryStack undo/redo)
 */

export const historyStackStructure = `flowchart LR
  subgraph HistoryStack
    direction TB
    E0["entries[0] (最旧)"]
    E1["entries[1]"]
    E2["entries[2]"]
    E3["entries[3] (最新)"]
    E0 --- E1 --- E2 --- E3

    CUR["cursor = 3 (指向最后已应用)"]
    CUR -.- E3

    EV["onEvict 回调 (LRU 淘汰时触发)"]
    EV -.->|清理 outputs 资产| OPFS[(OPFS / IDB)]

    BUS["eventBus emit history:changed"]
  end

  U[undo: cursor-- → 返回 entry.inputs]
  R[redo: cursor++ → 返回 entry.outputs]
  A[append: 截断 cursor 之后 → push → LRU 检查]

  U --> HistoryStack
  R --> HistoryStack
  A --> HistoryStack`;

export const historyOperationFlow = `flowchart TD
  Start([操作请求]) --> Op{操作类型}

  Op -->|append| A1{cursor < length-1? 有 redo 分支?}
  A1 -->|是| A2[截断 cursor 之后的条目]
  A1 -->|否| A3
  A2 --> A3[push 新 entry]
  A3 --> A4{length > maxEntries?}
  A4 -->|是| A5[shift 最旧条目 cursor-- 调用 onEvict]
  A4 -->|否| A6
  A5 --> A6[cursor = length-1]
  A6 --> A7[emit history:changed]

  Op -->|undo| U1{cursor >= 0?}
  U1 -->|否| U2[返回 null]
  U1 -->|是| U3[entry = entries cursor cursor--]
  U3 --> U4[返回 entry.inputs]
  U4 --> U5[emit history:changed]

  Op -->|redo| R1{cursor < length-1?}
  R1 -->|否| R2[返回 null]
  R1 -->|是| R3[cursor++ entry = entries cursor]
  R3 --> R4[返回 entry.outputs]
  R4 --> R5[emit history:changed]`;

export const undoRedoFlow = `flowchart TD
  Run([run 完成 cursor=N-1]) --> Idle([用户查看结果])

  Idle --> Undo{调用 undo?}
  Undo -->|是| U1[getOrCreateHistoryStack]
  U1 --> U2{canUndo? cursor >= 0}
  U2 -->|否| U3[无操作返回]
  U2 -->|是| U4[entry = entries cursor cursor--]
  U4 --> U5[emit history:changed]
  U5 --> U6[返回 entry.inputs UI 恢复为上一步资产]
  U6 --> Idle

  Idle --> Redo{调用 redo?}
  Redo -->|是| R1[getOrCreateHistoryStack]
  R1 --> R2{canRedo? cursor < length-1}
  R2 -->|否| R3[无操作返回]
  R2 -->|是| R4[cursor++ entry = entries cursor]
  R4 --> R5[emit history:changed]
  R5 --> R6[返回 entry.outputs UI 恢复为该步结果]
  R6 --> Idle

  Idle --> NewOp{执行新操作?}
  NewOp -->|是| N1[run → recordHistory]
  N1 --> N2[append 新 entry]
  N2 --> N3{cursor < length-1? 有 redo 分支?}
  N3 -->|是| N4[截断 redo 分支 丢弃未来条目]
  N3 -->|否| N5[push]
  N4 --> N5
  N5 --> N6[emit history:changed]
  N6 --> Idle`;
