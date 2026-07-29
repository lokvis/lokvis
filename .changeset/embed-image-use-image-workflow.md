---
'@lokvis/embed-image': patch
---

新增 `useImageWorkflow` — 任意线性图片工作流的纯逻辑 hook(Layer 0),是 useImagePipeline 的泛化:

- 调用方传入任意步骤数组(`ImageWorkflowStepConfig[]`)而非 4 个内置预设,供 cloud 模版页内嵌试用区及三方站点使用
- 新增 `buildImageWorkflow(id, steps, name?, description?)` 构造器;超过 MAX_WORKFLOW_STEPS 等非法输入由 hook 捕获写入 error,不在渲染期抛出
- autoRun 键含步骤定义序列化:输入或步骤定义变化都自动重跑
- 从 `/hooks` barrel 与包根同时导出
