---
editUrl: false
next: false
prev: false
title: "prepareImport"
---

> **prepareImport**(`source`): `Promise`\<[`PreparedImport`](/docs/api/runtime/src/interfaces/preparedimport/)\>

Defined in: [runtime/src/asset-store.ts:178](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/asset-store.ts#L178)

从 AssetSource 准备导入数据(共享逻辑,供 Memory/OPFS/IDB store 复用):
提取 blob + MIME、生成 id、推断 type、构造 metadata(含富元数据)。
各 store 只需负责"写入 blob + 存元数据"。

W6.4:异步提取 dimensions(image)/ duration(video/audio)/ pages(pdf,暂 stub)。
富元数据提取失败时静默降级为 undefined,不阻断 import。

## Parameters

### source

[`AssetSource`](/docs/api/schema/src/type-aliases/assetsource/)

## Returns

`Promise`\<[`PreparedImport`](/docs/api/runtime/src/interfaces/preparedimport/)\>
