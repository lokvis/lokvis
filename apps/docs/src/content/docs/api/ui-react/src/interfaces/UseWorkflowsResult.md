---
editUrl: false
next: false
prev: false
title: "UseWorkflowsResult"
---

Defined in: [ui-react/src/hooks/useWorkflows.ts:61](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L61)

## Properties

### slots

> **slots**: [`WorkflowSlot`](/docs/api/ui-react/src/interfaces/workflowslot/)[]

Defined in: [ui-react/src/hooks/useWorkflows.ts:63](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L63)

当前所有工作流槽位(按 updatedAt 降序)

***

### limit

> **limit**: `number`

Defined in: [ui-react/src/hooks/useWorkflows.ts:71](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L71)

当前上限(免费 5 / Pro 无限)

***

### canSaveMore

> **canSaveMore**: `boolean`

Defined in: [ui-react/src/hooks/useWorkflows.ts:73](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L73)

是否还能再保存

***

### remaining

> **remaining**: `number`

Defined in: [ui-react/src/hooks/useWorkflows.ts:75](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L75)

还能再保存多少个

## Methods

### save()

> **save**(`input`): [`WorkflowSlot`](/docs/api/ui-react/src/interfaces/workflowslot/)

Defined in: [ui-react/src/hooks/useWorkflows.ts:65](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L65)

保存或更新工作流;超限时抛 Error

#### Parameters

##### input

[`SaveWorkflowInput`](/docs/api/ui-react/src/interfaces/saveworkflowinput/)

#### Returns

[`WorkflowSlot`](/docs/api/ui-react/src/interfaces/workflowslot/)

***

### remove()

> **remove**(`id`): `void`

Defined in: [ui-react/src/hooks/useWorkflows.ts:67](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L67)

按 id 删除槽位

#### Parameters

##### id

`string`

#### Returns

`void`

***

### load()

> **load**(`id`): [`Workflow`](/docs/api/schema/src/interfaces/workflow/) \| `null`

Defined in: [ui-react/src/hooks/useWorkflows.ts:69](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L69)

按 id 加载工作流到 store(返回 Workflow)

#### Parameters

##### id

`string`

#### Returns

[`Workflow`](/docs/api/schema/src/interfaces/workflow/) \| `null`

***

### exportToJson()

> **exportToJson**(`id`): `string` \| `null`

Defined in: [ui-react/src/hooks/useWorkflows.ts:77](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L77)

导出工作流为 JSON 字符串(可直接下载)

#### Parameters

##### id

`string`

#### Returns

`string` \| `null`

***

### exportAllToJson()

> **exportAllToJson**(): `string`

Defined in: [ui-react/src/hooks/useWorkflows.ts:79](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L79)

导出所有工作流为 JSON 数组字符串

#### Returns

`string`

***

### importFromJson()

> **importFromJson**(`json`, `options?`): `object`

Defined in: [ui-react/src/hooks/useWorkflows.ts:81](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L81)

从 JSON 字符导入工作流(单个或数组);返回导入结果(含跳过原因)

#### Parameters

##### json

`string`

##### options?

###### resolveCapability?

(`name`) => \{ `inputTypes`: `string`[]; `outputTypes`: `string`[]; \} \| `undefined`

###### maxSteps?

`number`

#### Returns

`object`

##### imported

> **imported**: `number`

##### skipped

> **skipped**: `object`[]
