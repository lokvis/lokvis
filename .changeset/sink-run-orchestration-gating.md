---
"@lokvis/sdk": minor
"@lokvis/ui-react": patch
---

下沉 UI store 执行编排 + 收敛本地门控上限(架构评审 #9)。

`@lokvis/sdk` 新增引擎中性的 `runWithProgress(runtime, workflow, inputs, { onNodeStatus })`:订阅 `node:started/finished/failed` → `runtime.run` → 逐个加载输出资产 → 卸载订阅,返回 `{ result, outputs, failedOutputIds }`。不感知 zustand / i18n / 缩略图刷新等 UI 关切,节点状态经中性 `NodeStatusUpdate` 回调上抛。

- `ui-react` workflow-slice 的 `run()` 改为委托 `runWithProgress`,仅保留 zustand 状态与 i18n 文案映射;删除 store 内手写的多事件订阅与输出加载循环,同步移除已无用的 `subscribeAll`。
- 新增 `@lokvis/ui-react` `gating` 单一来源模块(`FREE_PLAN_LIMITS` / `PRO_PLAN_LIMITS` / `planLimits`),`useCustomPresets` 与 `useWorkflows` 的 `FREE_*_LIMIT` / `PRO_*_LIMIT` 均从此派生,消除分散常量漂移。
