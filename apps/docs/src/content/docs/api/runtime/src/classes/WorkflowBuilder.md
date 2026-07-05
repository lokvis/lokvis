---
editUrl: false
next: false
prev: false
title: "WorkflowBuilder"
---

Defined in: [runtime/src/workflow-builder.ts:80](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L80)

WorkflowBuilder - 链式构造线性 Workflow。

抛错时机:
  - add() 超过 maxSteps 时立即抛错(避免构造完才发现步数超限)
  - build() 在节点为空 / 输入输出未设置时抛错
  - remove()/move() 在节点 id 不存在时静默(链式 API 容错)

## Constructors

### Constructor

> **new WorkflowBuilder**(`options`): `WorkflowBuilder`

Defined in: [runtime/src/workflow-builder.ts:88](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L88)

#### Parameters

##### options

[`WorkflowBuilderOptions`](/docs/api/runtime/src/interfaces/workflowbuilderoptions/)

#### Returns

`WorkflowBuilder`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [runtime/src/workflow-builder.ts:206](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L206)

当前节点数

##### Returns

`number`

***

### isFull

#### Get Signature

> **get** **isFull**(): `boolean`

Defined in: [runtime/src/workflow-builder.ts:211](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L211)

是否已达最大节点数

##### Returns

`boolean`

## Methods

### setInput()

> **setInput**(`input`): `this`

Defined in: [runtime/src/workflow-builder.ts:96](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L96)

设置工作流输入定义

#### Parameters

##### input

[`WorkflowInput`](/docs/api/schema/src/interfaces/workflowinput/)

#### Returns

`this`

***

### setOutput()

> **setOutput**(`output`): `this`

Defined in: [runtime/src/workflow-builder.ts:102](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L102)

设置工作流输出定义

#### Parameters

##### output

[`WorkflowOutput`](/docs/api/schema/src/interfaces/workflowoutput/)

#### Returns

`this`

***

### add()

> **add**(`capability`, `params?`, `label?`): `this`

Defined in: [runtime/src/workflow-builder.ts:115](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L115)

添加一个节点到链尾。

#### Parameters

##### capability

`string`

能力名,如 `image.resize`

##### params?

`Record`\<`string`, `unknown`\> = `{}`

能力参数(可选,默认空对象)

##### label?

`string`

节点标签(可选,UI 显示用)

#### Returns

`this`

#### Throws

Error 当节点数达到 maxSteps 时

***

### remove()

> **remove**(`capabilityOrId`): `this`

Defined in: [runtime/src/workflow-builder.ts:144](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L144)

按 capability 或节点 id 移除节点。
若有多个同 capability 节点,只移除第一个。
若不存在则静默(链式 API 容错)。

#### Parameters

##### capabilityOrId

`string`

能力名或节点 id

#### Returns

`this`

***

### move()

> **move**(`from`, `to`): `this`

Defined in: [runtime/src/workflow-builder.ts:161](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L161)

移动节点到新位置(线性链中重排)。

#### Parameters

##### from

`number`

源位置(0-based 索引)

##### to

`number`

目标位置(0-based 索引,移动后该节点的新位置)

#### Returns

`this`

#### Throws

Error 当索引越界

***

### swap()

> **swap**(`i`, `j`): `this`

Defined in: [runtime/src/workflow-builder.ts:180](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L180)

交换两个节点位置

#### Parameters

##### i

`number`

##### j

`number`

#### Returns

`this`

***

### updateParams()

> **updateParams**(`nodeId`, `params`): `this`

Defined in: [runtime/src/workflow-builder.ts:197](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L197)

更新指定节点的参数

#### Parameters

##### nodeId

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`this`

***

### getNodes()

> **getNodes**(): readonly `Readonly`\<`BuilderNode`\>[]

Defined in: [runtime/src/workflow-builder.ts:216](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L216)

获取节点的只读副本(用于 UI 预览)

#### Returns

readonly `Readonly`\<`BuilderNode`\>[]

***

### build()

> **build**(): [`Workflow`](/docs/api/schema/src/interfaces/workflow/)

Defined in: [runtime/src/workflow-builder.ts:225](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/runtime/src/workflow-builder.ts#L225)

构造 Workflow 实例。

#### Returns

[`Workflow`](/docs/api/schema/src/interfaces/workflow/)

#### Throws

Error 当节点为空 / 输入未设置 / 输出未设置
