/**
 * Engine 模块架构图(@lokvis/engine-image worker-adapter)
 */

export const engineWorkerFlow = `flowchart TD
  A[Worker 启动] --> B[startImageWorker scope]
  B --> C[发送 ready 携带 PROTOCOL_VERSION]
  C --> D{绑定 scope.onmessage}
  D --> E{消息分发}

  E -->|ping| F[回复 pong]
  E -->|request| G[createImageWorkerHandler]
  E -->|其他| H[忽略]

  G --> I{解析 method}
  I -->|image.resize| J1[operations.resize]
  I -->|image.compress| J2[operations.compress]
  I -->|image.convert| J3[operations.convert]
  I -->|...| J4[其他 8 个方法]
  I -->|未知 method| K[回复 ok=false 错误]

  J1 --> L[回复 response ok=true result]
  J2 --> L
  J3 --> L
  J4 --> L

  subgraph 依赖约束
    M[worker-adapter] --> N["@lokvis/schema 仅类型"]
    N -.->|不依赖| O["@lokvis/runtime"]
  end`;
