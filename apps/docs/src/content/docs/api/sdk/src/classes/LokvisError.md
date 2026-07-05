---
editUrl: false
next: false
prev: false
title: "LokvisError"
---

Defined in: [sdk/src/errors.ts:99](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L99)

Lokvis SDK 错误基类。

所有 SDK 抛出的错误都继承此类,消费方可通过 `instanceof LokvisError`
判定"是否 lokvis 域错误",再据 `code` 走分支。

## Example

```ts
try {
  await lokvis.run(workflow, [assetId]);
} catch (e) {
  if (e instanceof LokvisError) {
    if (e.code === 'STORAGE_QUOTA_EXCEEDED') alert('存储已满,请清理资产');
    else console.error(e.code, e.message, e.context);
  } else {
    throw e; // 非 lokvis 域错误,继续上抛
  }
}
```

## Extends

- `Error`

## Extended by

- [`AssetNotFoundError`](/docs/api/sdk/src/classes/assetnotfounderror/)
- [`AssetImportError`](/docs/api/sdk/src/classes/assetimporterror/)
- [`AssetExportError`](/docs/api/sdk/src/classes/assetexporterror/)
- [`WorkflowInvalidError`](/docs/api/sdk/src/classes/workflowinvaliderror/)
- [`WorkflowCycleError`](/docs/api/sdk/src/classes/workflowcycleerror/)
- [`WorkflowNodeError`](/docs/api/sdk/src/classes/workflownodeerror/)
- [`CapabilityNotRegisteredError`](/docs/api/sdk/src/classes/capabilitynotregisterederror/)
- [`CapabilityStubOnlyError`](/docs/api/sdk/src/classes/capabilitystubonlyerror/)
- [`StorageQuotaExceededError`](/docs/api/sdk/src/classes/storagequotaexceedederror/)
- [`StorageOpfsUnavailableError`](/docs/api/sdk/src/classes/storageopfsunavailableerror/)
- [`StorageIdbUnavailableError`](/docs/api/sdk/src/classes/storageidbunavailableerror/)
- [`WorkerCrashedError`](/docs/api/sdk/src/classes/workercrashederror/)
- [`WorkerTimeoutError`](/docs/api/sdk/src/classes/workertimeouterror/)
- [`WorkerDeadError`](/docs/api/sdk/src/classes/workerdeaderror/)
- [`WorkerRequestAbortedError`](/docs/api/sdk/src/classes/workerrequestabortederror/)
- [`WorkerHandshakeError`](/docs/api/sdk/src/classes/workerhandshakeerror/)
- [`DegradationRejectedError`](/docs/api/sdk/src/classes/degradationrejectederror/)
- [`PluginLoadError`](/docs/api/sdk/src/classes/pluginloaderror/)

## Constructors

### Constructor

> **new LokvisError**(`message`, `options`): `LokvisError`

Defined in: [sdk/src/errors.ts:103](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L103)

#### Parameters

##### message

`string`

##### options

[`LokvisErrorOptions`](/docs/api/sdk/src/interfaces/lokviserroroptions/)

#### Returns

`LokvisError`

#### Overrides

`Error.constructor`

## Properties

### code

> `readonly` **code**: [`LokvisErrorCode`](/docs/api/sdk/src/type-aliases/lokviserrorcode/)

Defined in: [sdk/src/errors.ts:100](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L100)

***

### context?

> `readonly` `optional` **context?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

Defined in: [sdk/src/errors.ts:101](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L101)
