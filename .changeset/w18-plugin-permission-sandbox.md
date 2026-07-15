---
'@lokvis/schema': minor
'@lokvis/runtime': minor
---

W18.6: Plugin 权限沙箱 — network:none 强制 + filesystem 断言

## 新增

### `PluginPermissionSandbox`(schema 接口 + runtime 实现)

Plugin 声明的 `permissions` 现在通过沙箱强制执行,而非纯文档:

- **schema**: 新增 `PluginPermissionSandbox` 接口(`has` / `assertNetworkAllowed` / `assertFilesystemAllowed`)
- **schema**: `PluginContext` 新增 `sandbox: PluginPermissionSandbox` 字段
- **runtime**: `PluginPermissionSandbox` 类实现接口,提供 `applyNetworkGuard()` 方法
- **runtime**: `installPlugin()` 在 install 期间自动应用 network guard(声明 `network:none`
  时 monkey-patch `fetch` / `XMLHttpRequest.open` / `WebSocket` / `EventSource`,
  调用即抛 `NetworkGuardError`),install 后 restore 原实现

### 新增错误类

- `PluginPermissionError` — 权限断言失败(声明 X 但未声明 Y)
- `NetworkGuardError` — 声明 network:none 又调网络 API
- `FilesystemGuardError` — 声明未含 filesystem:* 又调文件系统 API

## 迁移指南

### Plugin 作者

`PluginContext` 新增了 `sandbox` 字段。现有插件**无需修改**——`sandbox`
由 Runtime 自动注入,插件代码无需显式使用。

如果插件需要调用网络或文件系统 API,建议在调用前主动断言:

```typescript
// 声明 network:none 的插件调 fetch 前自检
ctx.sandbox.assertNetworkAllowed('loading model manifest');

// 声明 filesystem:opfs 的插件调 OPFS 前自检
ctx.sandbox.assertFilesystemAllowed('opfs', 'writing cache');
```

### 测试 mock 更新

Plugin 测试中手动构造 `PluginContext` mock 需新增 `sandbox` 字段:

```typescript
const ctx: PluginContext = {
  // ... 其他字段
  sandbox: {
    pluginName: 'mock',
    declared: new Set(['asset:read', 'asset:write']),
    has: () => true,
    assertNetworkAllowed: () => {},
    assertFilesystemAllowed: () => {},
  },
};
```

## 行为对比

| 场景 | 旧 | 新 |
|------|-----|-----|
| 声明 `network:none` 的插件在 install 时调 `fetch()` | 静默成功 | 抛 `NetworkGuardError` |
| 声明 `network:limited`/`network:full` | 无限制 | 无限制(不 patch) |
| 未声明任何权限 | 无限制 | 无限制(向后兼容) |
| install 后异步调网络(setTimeout 回调) | 无法拦截 | **仍无法拦截**(best-effort) |
