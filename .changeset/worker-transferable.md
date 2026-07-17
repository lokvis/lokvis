---
"@lokvis/runtime": minor
"@lokvis/engine-image": minor
---

W21.4: Worker 通信 Transferable 优化,实现 Blob 零拷贝传递。

Worker → 主线程的 Blob 数据此前走结构化克隆(完整拷贝字节),
大图(>1MB)每张拷贝一次,批量场景峰值内存翻倍。

变更:
- 新增 BlobRef 协议类型(runtime/worker-protocol.ts + engine-image/worker-adapter.ts
  同步声明,遵循 WorkerCancel 先例):Blob 拆为 { kind, meta, buffer }
- createImageWorkerHandler 返回 { response, transfer },Blob 结果
  抽 ArrayBuffer 放入 transfer list
- startImageWorker 的 postMessage 补 transfer list 参数
- WorkerHost.handleMessage 收到 response 后用 unwrapBlobRef() 重组 Blob
- FakeScope 测试桩扩展:记录 transfer list
- 新增 1 个测试:非 Blob 结果 transfer 为空数组

注:Worker 管线尚未在生产路径启用(当前 plugin-image 直接调主线程 canvasEngine),
此优化为 Worker-isolated runtime 上线做好准备。Host 侧已支持 transfer
(WorkerHost.request 的 options.transfer),调用方在 Worker 上线时补请求路径即可。
