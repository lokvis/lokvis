/**
 * Runtime 模块架构图(LokvisRuntimeImpl run() 时序)
 */

export const runtimeRunSequence = `sequenceDiagram
  participant Caller as 调用方
  participant RT as LokvisRuntimeImpl
  participant Q as checkStorageQuota
  participant EX as WorkflowExecutor
  participant AS as AssetStore
  participant HS as HistoryStack
  participant EB as EventBus

  Caller->>RT: run(workflow, inputs)
  RT->>Q: checkStorageQuota(storageQuota)

  alt 已用量超限
    Q-->>RT: throw QuotaExceededError
    RT-->>Caller: 抛错 (status=error)
  else 配额充足
    Q-->>RT: 通过
    RT->>EX: execute(workflow, inputs)

    loop 每个 transform 节点
      EX->>AS: getBlob / create (处理资产)
      EX->>EB: emit node:started / node:finished
    end

    EX-->>RT: WorkflowResult (status=completed)

    alt 执行成功
      RT->>HS: getOrCreateHistoryStack(workflowId)
      loop 每个 transform 节点
        RT->>HS: append(HistoryEntry)
        HS->>EB: emit history:changed
      end

      Note over HS: 若超出 maxEntries onEvict 清理 outputs 资产
      HS->>AS: remove(evicted.outputs) [可选]
    end

    RT-->>Caller: WorkflowResult
  end`;
