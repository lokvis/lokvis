---
editUrl: false
next: false
prev: false
title: "OpfsMetadataDatabase"
---

Defined in: [runtime/src/opfs-asset-store.ts:52](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/opfs-asset-store.ts#L52)

OPFS 元数据持久化数据库(W6.6)。

仅存 { id, asset }(不含 blob,blob 在 OPFS 文件里),用于刷新后恢复内存 Map。
数据库名独立于 IdbAssetStore 的 'lokvis-assets',避免与全持久化 store 冲突。

## Extends

- `Dexie`

## Constructors

### Constructor

> **new OpfsMetadataDatabase**(`name?`): `OpfsMetadataDatabase`

Defined in: [runtime/src/opfs-asset-store.ts:55](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/opfs-asset-store.ts#L55)

#### Parameters

##### name?

`string` = `'lokvis-opfs-metadata'`

#### Returns

`OpfsMetadataDatabase`

#### Overrides

`Dexie.constructor`

## Properties

### OpenFailedError

> `static` **OpenFailedError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.OpenFailedError`

***

### VersionChangeError

> `static` **VersionChangeError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.VersionChangeError`

***

### SchemaError

> `static` **SchemaError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.SchemaError`

***

### UpgradeError

> `static` **UpgradeError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.UpgradeError`

***

### InvalidTableError

> `static` **InvalidTableError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.InvalidTableError`

***

### MissingAPIError

> `static` **MissingAPIError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.MissingAPIError`

***

### NoSuchDatabaseError

> `static` **NoSuchDatabaseError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.NoSuchDatabaseError`

***

### InvalidArgumentError

> `static` **InvalidArgumentError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.InvalidArgumentError`

***

### SubTransactionError

> `static` **SubTransactionError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.SubTransactionError`

***

### UnsupportedError

> `static` **UnsupportedError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.UnsupportedError`

***

### InternalError

> `static` **InternalError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.InternalError`

***

### DatabaseClosedError

> `static` **DatabaseClosedError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.DatabaseClosedError`

***

### PrematureCommitError

> `static` **PrematureCommitError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.PrematureCommitError`

***

### ForeignAwaitError

> `static` **ForeignAwaitError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.ForeignAwaitError`

***

### UnknownError

> `static` **UnknownError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.UnknownError`

***

### ConstraintError

> `static` **ConstraintError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.ConstraintError`

***

### DataError

> `static` **DataError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.DataError`

***

### TransactionInactiveError

> `static` **TransactionInactiveError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.TransactionInactiveError`

***

### ReadOnlyError

> `static` **ReadOnlyError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.ReadOnlyError`

***

### VersionError

> `static` **VersionError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.VersionError`

***

### NotFoundError

> `static` **NotFoundError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.NotFoundError`

***

### InvalidStateError

> `static` **InvalidStateError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.InvalidStateError`

***

### InvalidAccessError

> `static` **InvalidAccessError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.InvalidAccessError`

***

### AbortError

> `static` **AbortError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.AbortError`

***

### TimeoutError

> `static` **TimeoutError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.TimeoutError`

***

### QuotaExceededError

> `static` **QuotaExceededError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.QuotaExceededError`

***

### DataCloneError

> `static` **DataCloneError**: `DexieErrorConstructor`

#### Inherited from

`Dexie.DataCloneError`

***

### metadata

> **metadata**: `Table`\<[`OpfsMetadataRecord`](/docs/api/runtime/src/interfaces/opfsmetadatarecord/), `string`\>

Defined in: [runtime/src/opfs-asset-store.ts:53](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/opfs-asset-store.ts#L53)
