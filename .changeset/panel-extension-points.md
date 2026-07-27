---
'@lokvis/schema': minor
'@lokvis/runtime': minor
'@lokvis/ui-react': minor
---

Panel 扩展点兑现（registerPanel）：

- schema：`PanelDefinition` 类型 + `panel:registered` 事件
- runtime：`ctx.registerPanel()` 注册 Panel 并发射 `panel:registered` 事件
- ui-react：panels-slice 同步 Panel 列表；`PluginPanels` 组件按 location 渲染、
  `show({ selectedAssets })` 谓词求值；`registerPanelRenderer` 注册表解析
  component 标识为 React 组件（支持覆盖语义与反注册）
- Workspace slots：Canvas / Inspector / emptyState 支持 render prop，面板可隐藏
