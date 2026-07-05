---
editUrl: false
next: false
prev: false
title: "OpfsAssetStoreOptions"
---

Defined in: [runtime/src/opfs-asset-store.ts:72](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/opfs-asset-store.ts#L72)

OPFS AssetStore 配置

## Properties

### rootDirName?

> `optional` **rootDirName?**: `string`

Defined in: [runtime/src/opfs-asset-store.ts:74](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/opfs-asset-store.ts#L74)

OPFS 根目录下的命名空间目录名(默认 'lokvis')

***

### assetsDirName?

> `optional` **assetsDirName?**: `string`

Defined in: [runtime/src/opfs-asset-store.ts:76](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/opfs-asset-store.ts#L76)

资产子目录名(默认 'assets')

***

### rootHandle?

> `optional` **rootHandle?**: `FileSystemDirectoryHandle`

Defined in: [runtime/src/opfs-asset-store.ts:81](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/opfs-asset-store.ts#L81)

测试注入:自定义 OPFS 根目录句柄。
默认使用 navigator.storage.getDirectory()。

***

### metadataDb?

> `optional` **metadataDb?**: [`OpfsMetadataDatabase`](/docs/api/runtime/src/classes/opfsmetadatadatabase/)

Defined in: [runtime/src/opfs-asset-store.ts:86](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/opfs-asset-store.ts#L86)

测试注入:自定义元数据库实例(W6.6 持久化)。
默认在 IndexedDB 可用时自动创建 OpfsMetadataDatabase。

***

### metadataDbName?

> `optional` **metadataDbName?**: `string`

Defined in: [runtime/src/opfs-asset-store.ts:88](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/opfs-asset-store.ts#L88)

元数据库名(默认 'lokvis-opfs-metadata';仅 metadataDb 未注入时生效)
