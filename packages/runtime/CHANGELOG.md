# @lokvis/runtime

## 0.2.0

### Minor Changes

- 1ffd8c1: 架构清理:消除 plugin-* 重复代码 + 统一 worker-host transport 清理 + 修复 exif-reader 手动剔除字段 patch

  - **plugin-sdk**: 新增 `createBlobCapabilityImpl` 工厂 + `defaultDeriveOutputMetadata` + `BlobCapabilityOptions`。封装"取 blob → 调 operation → 派生 metadata → createAsset → 进度/取消"五步样板,消除 plugin-image / plugin-video / plugin-pdf(single kind)三份近乎逐字相同的 `wrapAsImplementation` + `deriveOutputMetadata`
  - **plugin-image**: 删除 `wrapAsImplementation` + `deriveOutputMetadata`(33 行),改用 `createBlobCapabilityImpl`
  - **plugin-video**: 同上,删除重复代码改用工厂
  - **plugin-pdf**: single kind 改用工厂;merge/split 形态不同保留自定义包装。`derivePdfMetadata` 改为返回 `(source, outBlob) => AssetMetadata` 签名以匹配工厂接口
  - **runtime**: `worker-host.ts` 的 `dispose()` 和 `spawn()` catch 块改为调用 `teardownTransport()`,消除三处重复的 `offMessage/offError/terminate/null` 清理样板
  - **plugin-image/exif-reader**: 删除"先构造 RawExifData 再解构删 raw"的 patch(`const { raw: _raw, ...exifData } = data; void _raw`),改为直接构造 `ExifData`。RawExifData 类型保留在 schema 供未来调试场景使用

  验证:lint 0 errors、typecheck 全绿、test 623/623 通过

- 2aebedb: - 新增 `RunOptions.appendHistory`:默认 reset 历史(向后兼容),`true` 时保留历史栈以支持跨次 `run()` 的 undo/redo 链(如连续滤镜)
  - 新增 `getCurrentOutputs(workflowId)` 公开 API,返回工作流当前输出 AssetId
  - `CapabilityRegistry` 新增 `hasImplementation()` / `isStubOnly()`,`resolve()` 自动过滤 `status: 'stub'` 实现
  - `EventBus.emit()` 对 handler 加 try/catch 隔离,`onAny` 集合使用 copy-on-iterate 支持 handler 在派发中自取消订阅
  - Executor 错误信息区分"仅有 stub 实现"与"完全无实现"
- e95976e: W10 Workflow Layer 实现(10.1-10.8)—— WorkflowBuilder + capability 兼容性校验 + 拖拽编辑器 + 槽位持久化

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

- bb5706c: EXIF 读取与查看面板(W7.3/7.4)——采用 MetadataReader 依赖反转长期方案,不进 Engine 层

  - **schema**:新增 `ExifData`(无 raw,面向 UI/Runtime)+ `RawExifData`(extends ExifData,Plugin 内部)+ `ExifRow` + `formatExifRows()` + `formatShutterSpeed()`。类型分层根治"UI 缓存需手动剔除 raw"的短期 patch。`PluginContext` 新增 `registerMetadataReader<T>(name, reader)` 方法,Plugin 提供查询函数,Runtime 持有引用按名调用
  - **plugin-image**:新增 `exif-reader.ts` 实现 `readExifFromBlob`(exifr ^7.1.3,零 WASM)。`imageToolsPlugin` installer 中通过 `ctx.registerMetadataReader('image.read-exif', ...)` 注册,返回前 RawExifData→ExifData 收窄(丢弃 raw)
  - **runtime**:`LokvisRuntime` 接口新增 `readAssetExif(id)`,`LokvisRuntimeImpl` 持有 `metadataReaders` Map + `_registerMetadataReader()`。Plugin 未安装时优雅降级返回 null
  - **sdk**:`installPlugin` / `createPluginContext` 接收 runtime 实例,`registerMetadataReader` 转发到 `runtime._registerMetadataReader`
  - **ui-react**:新增 `ExifPanel.tsx`(LRU cache 上限 16,effect 依赖 selectedAssetId 非 asset 引用),接入 `Inspector` 顶部。非 image 资产自动隐藏
  - 删除 `engine-image/src/operations/exif.ts` 占位文件(EXIF 不属于 Engine 层 Blob↔Blob 契约)
  - 新增 26 测试:schema 11 + plugin-image 9 + runtime 6。全部 523/523 通过,coverage lines 90.03% / branches 89.24%

### Patch Changes

- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
  - @lokvis/schema@0.2.0

## 0.2.0-beta.0

### Minor Changes

- - 新增 `RunOptions.appendHistory`:默认 reset 历史(向后兼容),`true` 时保留历史栈以支持跨次 `run()` 的 undo/redo 链(如连续滤镜)
  - 新增 `getCurrentOutputs(workflowId)` 公开 API,返回工作流当前输出 AssetId
  - `CapabilityRegistry` 新增 `hasImplementation()` / `isStubOnly()`,`resolve()` 自动过滤 `status: 'stub'` 实现
  - `EventBus.emit()` 对 handler 加 try/catch 隔离,`onAny` 集合使用 copy-on-iterate 支持 handler 在派发中自取消订阅
  - Executor 错误信息区分"仅有 stub 实现"与"完全无实现"

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.2.0-beta.0
