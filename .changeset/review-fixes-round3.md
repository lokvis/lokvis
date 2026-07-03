---
'@lokvis/ui-core': patch
'@lokvis/sdk': patch
---

修复 code review 发现的 7 个问题(跨包第三轮)

- `ui-core` Slider:非受控模式下 `showValue` 显示值不随拖动更新,改用 internal state 跟踪当前值
- `ui-core` Tabs:`useCallback` 依赖 `items`(数组字面量,每次渲染新引用)导致 memo 失效,改为普通函数
- `ui-core` Dialog:模块级 `bodyOverflowLockCount` / `bodyOverflowPrev` 在 Vite HMR 重新执行模块时不重置,可能导致 body 永久锁死;添加 `import.meta.hot?.dispose` 清理回调
- `sdk` CapabilityNotRegisteredError:构造函数不接受 `cause` 参数,`fromLokvisError` message 匹配分支丢失原始错误链路;补充 `cause?` 参数并传入
- `sdk` fromLokvisError:`WorkflowNodeError('', '', msg, value)` 用空 nodeId 不利于定位失败节点,改为从 message 提取 nodeId
- `docs` sdk.md:示例 `fromLokvisError` 总是返回 LokvisError,`instanceof LokvisError` 检查冗余且 else 分支为死代码;`err.guide` 需 `instanceof DegradationRejectedError` 窄化类型才能访问
- `examples` custom-workspace:删除 `fromLokvisError` 后无法触达的 else 死代码分支
