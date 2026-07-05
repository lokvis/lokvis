---
editUrl: false
next: false
prev: false
title: "createLokvis"
---

> **createLokvis**(`options?`): `Promise`\<[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/)\>

Defined in: [sdk/src/index.ts:87](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/index.ts#L87)

创建 Lokvis Runtime 实例。

初始化 Runtime(OPFS/IndexedDB 资产存储、能力注册表、事件总线、Worker 隔离),
并按 `options.plugins` 顺序预加载插件。返回的 `LokvisRuntime` 实例是所有
后续操作的入口(importAsset / run / capabilities / eventBus ...)。

## Parameters

### options?

[`CreateLokvisOptions`](/docs/api/sdk/src/interfaces/createlokvisoptions/) = `{}`

## Returns

`Promise`\<[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/)\>

## Example

```ts
const lokvis = await createLokvis({
  plugins: [imageToolsPlugin()],
  storageQuota: 1024 * 1024 * 1024, // 1GB
});
```
