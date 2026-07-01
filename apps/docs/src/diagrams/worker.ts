/**
 * Worker 模块架构图(WorkerHost / worker-protocol)
 */

export const workerSequenceDiagram = `sequenceDiagram
  participant H as WorkerHost(主线程)
  participant W as Worker
  participant T as WorkerTransport

  Note over H,W: 1. 启动与握手
  H->>T: createTransport()
  H->>T: onMessage / onError
  H->>H: 等待 ready(超时 10s)
  W-->>H: { type: "ready", protocolVersion: "0.1.0" }
  H->>H: 校验版本 → status: ready
  H->>H: startHeartbeat(间隔 5s)

  Note over H,W: 2. 心跳保活
  H-->>W: { type: "ping", id, ts }
  W-->>H: { type: "pong" }
  Note over H: 收到 pong → 清除超时定时器

  Note over H,W: 3. 请求/响应
  H-->>W: { type: "request", id, method, params }
  Note over H: 记录 pending[id] + 独立超时(60s)
  W-->>H: { type: "response", id, ok: true, result }
  H->>H: 按 id 关联 → resolve Promise

  Note over H,W: 4. 崩溃与重启
  W--xH: 传输层 error / 心跳超时(15s 无 pong)
  H->>H: handleCrash: status=restarting
  H->>H: rejectAllPending(WorkerCrashedError)
  H->>T: terminate()
  Note over H: restartCount < maxRestarts(3)?
  H->>T: createTransport() 重建
  W-->>H: { type: "ready" } 握手
  H->>H: emit("restart") → status: ready`;

export const workerStateDiagram = `stateDiagram-v2
  [*] --> idle: 构造
  idle --> ready: init() → spawn() → ready 握手成功
  idle --> [*]: 握手超时(抛 WorkerHandshakeError)

  ready --> restarting: handleCrash(传输层 error / 心跳超时)
  ready --> disposed: dispose()

  restarting --> ready: spawn 成功 → emit("restart")
  restarting --> restarting: spawn 失败 → tryRestart 递归(restartCount++)
  restarting --> dead: restartCount >= maxRestarts
  restarting --> disposed: dispose()

  dead --> [*]: 上层降级处理
  disposed --> [*]: 终止 transport + 清理定时器`;
