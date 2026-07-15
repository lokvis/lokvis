---
'@lokvis/plugin-sdk': minor
---

W18.1 + W18.2 + W18.6: Plugin SDK Alpha 发版准备 — 文档 + 权限沙箱接口 + npm 元数据

## 新增

### W18.2 Plugin SDK 文档(W18.2 已完成,本次 changeset 标记版本)

- `packages/plugin-sdk/README.md` 新建(~200 行):Quick start + 3 工厂表 +
  `BlobCapabilityOptions` 接口 + `PluginContext` API 完整字段表(含 W18.6
  `sandbox`)+ 生命周期时序图 + Stub engine 处理 + 类型 re-export 清单
- `apps/docs/src/content/docs/architecture/plugin.mdx` 权限模型章节从
  advisory 更新为 W18.6 enforced(含 7 行权限表 + Enforcement 列 +
  network guard 子章节 + `ctx.sandbox` 子章节),中英两版同步

### W18.6 权限沙箱接口(经 schema 传递到 plugin-sdk 类型)

Plugin SDK 通过 `@lokvis/schema` 的 `PluginContext.sandbox` 字段获得
`PluginPermissionSandbox` 类型。Plugin 作者可在 install 期间主动断言:

```typescript
ctx.sandbox.assertNetworkAllowed('loading model manifest');
ctx.sandbox.assertFilesystemAllowed('opfs', 'writing cache');
```

### W18.1 npm 发版准备

- `package.json` 补全 npm 元数据:`author` / `homepage` / `bugs.url` /
  `keywords`(8 个:lokvis/plugin/sdk/image-processing/browser/local-first/
  capability/runtime),提升 npmjs.com 搜索发现性
- README "Status: Alpha" 章节更新:权限模型从 "partially enforced (advisory)"
  改为 "enforced as of W18.6"

## 迁移

无需修改现有插件代码。`PluginContext.sandbox` 由 Runtime 自动注入,
插件代码可选使用 `assertNetworkAllowed` / `assertFilesystemAllowed`
进行主动权限断言。

## 发版流程

实际 npm publish 由 `.github/workflows/release.yml` 在 `v*` tag 推送时
自动执行。详见 `docs/reports/W18.1-plugin-sdk-npm-release-readiness.md`。
