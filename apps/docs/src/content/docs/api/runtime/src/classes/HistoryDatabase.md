---
editUrl: false
next: false
prev: false
title: "HistoryDatabase"
---

Defined in: [runtime/src/history-store.ts:48](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L48)

历史持久化数据库。

独立于 OpfsMetadataDatabase('lokvis-opfs-metadata')与 IdbAssetStore
('lokvis-assets'),避免与资产元数据冲突。表以 workflowId 为主键,
额外索引 updatedAt 便于未来按时间清理陈旧记录。

## Extends

- `Dexie`

## Constructors

### Constructor

> **new HistoryDatabase**(`name?`): `HistoryDatabase`

Defined in: [runtime/src/history-store.ts:51](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L51)

#### Parameters

##### name?

`string` = `'lokvis-history'`

#### Returns

`HistoryDatabase`

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

### history

> **history**: `Table`\<[`HistoryRecord`](/docs/api/runtime/src/interfaces/historyrecord/), `string`\>

Defined in: [runtime/src/history-store.ts:49](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/history-store.ts#L49)
