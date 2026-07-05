---
editUrl: false
next: false
prev: false
title: "createRuntime"
---

> **createRuntime**(`config?`): `Promise`\<[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/)\>

Defined in: [runtime/src/runtime.ts:912](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/runtime.ts#L912)

创建 Runtime 实例(W2.8 + W2.9)。

默认通过 createAssetStore 工厂按 OPFS → IndexedDB → Memory 降级创建 AssetStore,
并用配额校验包裹。也可通过 config.assetStore 注入自定义 store。

注:此函数为 async(工厂需异步探测环境)。SDK 的 createLokvis 已是 async。

## Parameters

### config?

[`RuntimeConfig`](/docs/api/runtime/src/interfaces/runtimeconfig/)

## Returns

`Promise`\<[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/)\>
