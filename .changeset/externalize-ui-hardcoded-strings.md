---
"@lokvis/ui-react": patch
---

外移 UI 层硬编码的本地化文案(架构评审 #10)。

工作流模板数据(`workflow-templates.ts`)不再内嵌中文名称/描述:`WorkflowTemplate` 改为携带 `nameKey` / `descriptionKey` i18n 键,由 `WorkflowTemplates` 组件经 `t()` 解析;新增 5 个模板 × 名称/描述共 10 条 6 语言词条;电商模板水印默认文案由中文 `店铺名` 改为中性 `@shop`。

`useWorkflows` / `useCustomPresets` 的保存/导入校验不再 `throw new Error('中文文案')`:改为抛出结构化 `LokvisStorageError`(携带稳定 `code` + i18n `messageKey` + 插值 `params` + 英文兜底 message),消费方 `catch` 后可 `t(err.messageKey, err.params)` 本地化展示;新增 9 条对应错误词条,并从包入口导出 `LokvisStorageError` / `LokvisStorageErrorCode`。
