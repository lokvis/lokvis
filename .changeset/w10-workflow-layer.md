---
"@lokvis/runtime": minor
"@lokvis/schema": minor
"@lokvis/ui-react": minor
---

W10 Workflow Layer 实现(10.1-10.8)—— WorkflowBuilder + capability 兼容性校验 + 拖拽编辑器 + 槽位持久化

- **runtime·WorkflowBuilder**(10.1):新增 `packages/runtime/src/workflow-builder.ts`。链式 API `add/remove/move/swap/updateParams` + `setInput/setOutput` + 5 步上限 `MAX_WORKFLOW_STEPS=5`。`build()` 校验空节点/输入未设置/输出未设置。`workflowToBuilder()` 反向构造(用于编辑已有工作流,跳过 load/export 节点)。导出常量 `MAX_WORKFLOW_STEPS` 供 runtime.run() 使用
- **schema·validateWorkflow**(10.2):新增 `ValidateWorkflowOptions` 参数(`resolveCapability` 回调 + `maxSteps`)。新增 `validateCapabilityCompatibility()` 内部函数检查 3 层兼容性:
  - 输入节点(入度 0)的 inputTypes 与 workflow.inputs.type
  - 相邻节点 edge.from outputTypes 与 edge.to inputTypes 必须有交集
  - 输出节点(出度 0)的 outputTypes 与 workflow.outputs.type(archive 类型豁免)
  - 未注册的 capability 跳过该校验(向后兼容)
  - resolveCapability 未提供时跳过全部兼容性校验(向后兼容)
- **schema·枚举类型修正**:新增 `workflowCategorySchema` 与 `workflowOutputTypeSchema` zod enum。`workflowSchema` 的 `category` 从 `z.string()` 改为 `workflowCategorySchema`,`outputs.type` 从内联 enum 改为 `workflowOutputTypeSchema`。消除 zod 推断 `string` 与 TS 类型 `WorkflowCategory`/`WorkflowOutput['type']` 不一致的类型谎言(此前需 `as unknown as Workflow` 双断言,违反 AGENTS.md)
- **runtime·run()**(10.3):调用 `validateWorkflow()` 时传入 `maxSteps: MAX_WORKFLOW_STEPS(5)` + `resolveCapability` 回调(从 `capabilityRegistry.get(name)` 取 inputTypes/outputTypes)。capability 兼容性问题在入口处暴露,而非执行中途
- **ui-react·WorkflowEditor**(10.4):新增 `packages/ui-react/src/components/WorkflowEditor.tsx`。基于 HTML5 Drag and Drop API 实现节点拖拽重排(无需额外依赖):
  - 拖拽节点到任意位置重排线性链,拖拽时显示插入指示器
  - 键盘支持:选中节点后 ← → 移动 / Delete / Backspace 删除(无障碍)
  - 步骤序号 1-5 显示
  - 5 步上限提示(达到上限时步数标 orange)
  - Clear 按钮(确认弹窗)
  - 触摸设备降级为按钮交互(HTML5 DnD 在移动端支持不佳)
  - Workspace 新增 `enableWorkflowEditor` prop(默认 false,关闭则用只读 PipelineBar)
- **ui-react·store**:新增 `moveNode(from, to)` action(线性链重排)。`addNode` 加 5 步上限校验(达到上限时设置 error 而非抛错)
- **ui-react·useWorkflows**(10.6 + 10.7):新增 `packages/ui-react/src/hooks/useWorkflows.ts`。5 个工作流槽位本地保存(免费 5 / Pro 无限):
  - localStorage 持久化 `lokvis.workflows` key
  - 跨 tab storage 事件 + 同 tab SYNC_EVENT 自定义事件双重同步
  - workflowSchema 容错:加载时 safeParse 过滤损坏条目,保存时校验数据完整性
  - `save(input)` / `remove(id)` / `load(id)` 完整 CRUD
  - `exportToJson(id)` / `exportAllToJson()` 导出 JSON 字符串(可直接下载)
  - `importFromJson(json, options)` 导入:validateWorkflow 完整校验(含 capability 兼容性若提供回调),宽容跳过无效条目,超限抛错
  - 返回 `{ slots, save, remove, load, limit, canSaveMore, remaining, exportToJson, exportAllToJson, importFromJson }`
- **ui-react·ParamForm**(10.5):已存在,无需修改。支持 boolean/enum/color/number/string 五种控件自动生成,含 min/max/required 标记,紧凑行内布局适配 Inspector
- **测试**(10.8):新增 49 测试
  - `schema/__tests__/validators.test.ts` +18:capability 兼容性校验 7(兼容通过 / 不兼容失败 / 输入节点 / 输出节点 / archive 豁免 / 未注册跳过 / 无回调跳过)+ maxSteps 3(等于通过 / 超过失败 / 未提供不限制)+ 枚举 schema 8(category 合法值 10 / 非法值 / outputs.type 合法 / 非法)
  - `runtime/__tests__/workflow-builder.test.ts` +31:链式 API 4 + 5 步上限 3 + remove 4(按 capability / 按 id / 不存在静默 / 多个同 capability 只移第一个)+ move/swap 4 + updateParams 2 + build 校验 4 + 构造选项 8 + 节点 id 1 + label 2 + workflowToBuilder 3
- **验证**:typecheck 36/36、test 726/726(新增 49)、build 20/20
