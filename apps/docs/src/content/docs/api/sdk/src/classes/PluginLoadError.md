---
editUrl: false
next: false
prev: false
title: "PluginLoadError"
---

Defined in: [sdk/src/errors.ts:291](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L291)

插件加载/安装失败。

## Param

**pluginName**

插件名(优先,便于日志聚合按插件维度统计)

## Param

**message**

人类可读错误描述

## Param

**cause**

原始错误(可选)

注意:参数顺序为 `(pluginName, message, cause)`,与其他类的 `(message, cause)` 不同,
因为插件名是 PluginLoadError 的核心标识,放首位便于构造时一眼识别。

## Extends

- [`LokvisError`](/docs/api/sdk/src/classes/lokviserror/)

## Constructors

### Constructor

> **new PluginLoadError**(`pluginName`, `message`, `cause?`): `PluginLoadError`

Defined in: [sdk/src/errors.ts:293](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L293)

#### Parameters

##### pluginName

`string`

##### message

`string`

##### cause?

`unknown`

#### Returns

`PluginLoadError`

#### Overrides

[`LokvisError`](/docs/api/sdk/src/classes/lokviserror/).[`constructor`](/docs/api/sdk/src/classes/lokviserror/#constructor)

## Properties

### code

> `readonly` **code**: [`LokvisErrorCode`](/docs/api/sdk/src/type-aliases/lokviserrorcode/)

Defined in: [sdk/src/errors.ts:100](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L100)

#### Inherited from

[`LokvisError`](/docs/api/sdk/src/classes/lokviserror/).[`code`](/docs/api/sdk/src/classes/lokviserror/#code)

***

### context?

> `readonly` `optional` **context?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

Defined in: [sdk/src/errors.ts:101](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L101)

#### Inherited from

[`LokvisError`](/docs/api/sdk/src/classes/lokviserror/).[`context`](/docs/api/sdk/src/classes/lokviserror/#context)

***

### pluginName

> `readonly` **pluginName**: `string`

Defined in: [sdk/src/errors.ts:292](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L292)
