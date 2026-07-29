---
'@lokvis/embed-image': patch
---

`useImageWorkflow` 新增多 target（变体）支持：

- 新增 `ImageWorkflowTargetConfig`（变体名 + `overrides`：capability → params 浅合并到匹配步骤）与 `ImageWorkflowTargetOutput` 类型，并从 `/hooks` barrel 与包根导出
- `options.targets?` 非空时进入多变体模式：对每个 target 构造独立线性 workflow（id 为 `${id}--${target.name}`）并顺序执行，复用同一输入，每个变体完成即追加 `targetOutputs`（渐进显示）
- 返回值新增 `targetOutputs`（已完成变体输出）与 `currentTarget`（执行中变体索引，单 target 模式恒为 -1）
- target 输出持有独立 object URL，与 steps 的 URL 生命周期解耦；`onComplete` 整批完成后触发一次，`outputSize` 为各变体之和
- autoRun 键纳入 targets 定义序列化：输入或 steps/targets 定义变化均自动重跑
