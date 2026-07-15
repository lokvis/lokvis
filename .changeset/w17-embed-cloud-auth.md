---
'@lokvis/ui-react': minor
---

W17.6: examples 接 cloud auth — `useLokvis` / `<Workspace>` 支持 `auth` 透传

## 新增

### `UseLokvisOptions.auth?: LokvisAuthSession`

`useLokvis()` hook 新增 `auth` 字段,透传到 `createLokvis({ auth })`,
使 `<Workspace auth={...} />` 组件可直接接收 cloud session/token。

`WorkspaceProps extends UseLokvisOptions`,所以 `auth` 作为 `<Workspace />`
的 prop 自动可用,无需额外改动 Workspace 组件。

### 示例升级:`examples/embedding`

`App.tsx` 从纯本地模式升级为演示 3 种 auth 集成模式:
- **Free**(本地):`auth: undefined` → 批量 10 / 并发 4 / 槽位 5 / 预设 3
- **Pro**(cloud session):`auth: { session: jwt }` → 全部上限放宽
- **Guest**(cloud 游客):`auth: { session: jwt, isPro: false }` → 显式标记游客

侧边栏新增 Auth Mode 切换器(仅演示用,真实集成中 auth 由宿主应用 auth context 决定)。
`useLokvis` 通过 `JSON.stringify(auth)` 监听 auth 内容变化,自动重新初始化 Runtime(无需 key remount)。

README 重写,新增 "Cloud auth integration (W17.6)" 章节:
- 3 种 auth 模式对比表(isPro / batch / concurrency / slots / presets)
- 真实集成代码示例(从宿主 auth context 读取 session)
- 显式游客 override 示例(`isPro: false` 覆盖 presence 推导)
- API token 场景(CLI / SSR,`auth: { token }`)

## 迁移

**无需修改现有代码**。`auth` 是可选字段,不传时行为不变(保持 free 模式)。

要启用 cloud Pro 模式,只需:

```tsx
<Workspace
  plugins={[imageToolsPlugin()]}
  auth={session ? { session } : undefined}
/>
```

`@lokvis/sdk` 依赖新增到 example 的 `dependencies`(用于 `LokvisAuthSession` 类型导入,
type-only,无运行时成本)。
