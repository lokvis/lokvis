---
"@lokvis/runtime": minor
---

- 新增 `RunOptions.appendHistory`:默认 reset 历史(向后兼容),`true` 时保留历史栈以支持跨次 `run()` 的 undo/redo 链(如连续滤镜)
- 新增 `getCurrentOutputs(workflowId)` 公开 API,返回工作流当前输出 AssetId
- `CapabilityRegistry` 新增 `hasImplementation()` / `isStubOnly()`,`resolve()` 自动过滤 `status: 'stub'` 实现
- `EventBus.emit()` 对 handler 加 try/catch 隔离,`onAny` 集合使用 copy-on-iterate 支持 handler 在派发中自取消订阅
- Executor 错误信息区分"仅有 stub 实现"与"完全无实现"
