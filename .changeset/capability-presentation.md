---
'@lokvis/schema': minor
'@lokvis/ui-react': minor
---

能力机制补强：

- ui-react store 订阅 `plugin:loaded` 事件，初始化后 loadPlugin() 加载的
  插件其 capability 自动进入 Inspector / CommandPalette / WorkflowEditor，
  无需手动调用 refreshCapabilities()
- schema：`Capability` 新增可选 presentation 元数据（`label` / `icon` / `group`），
  纯 UI 展示提示，不影响执行、校验与 MCP manifest
- ui-react：Inspector / CommandPalette / WorkflowEditor 能力列表消费
  presentation 元数据（label 回退 name、group 回退 domain 前缀、icon 原样渲染），
  搜索支持 label 匹配
