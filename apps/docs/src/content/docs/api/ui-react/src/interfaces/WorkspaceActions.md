---
editUrl: false
next: false
prev: false
title: "WorkspaceActions"
---

Defined in: [ui-react/src/store/types.ts:70](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L70)

工作台操作

## Methods

### init()

> **init**(`runtime`): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:72](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L72)

初始化 Runtime

#### Parameters

##### runtime

[`LokvisRuntime`](/docs/api/runtime/src/interfaces/lokvisruntime/)

#### Returns

`Promise`\<`void`\>

***

### refreshAssets()

> **refreshAssets**(): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:74](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L74)

刷新资产列表

#### Returns

`Promise`\<`void`\>

***

### refreshCapabilities()

> **refreshCapabilities**(): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:76](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L76)

刷新能力列表

#### Returns

`Promise`\<`void`\>

***

### importFiles()

> **importFiles**(`files`): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:78](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L78)

导入文件

#### Parameters

##### files

`File`[]

#### Returns

`Promise`\<`void`\>

***

### selectAsset()

> **selectAsset**(`id`): `void`

Defined in: [ui-react/src/store/types.ts:80](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L80)

选择资产

#### Parameters

##### id

`string` \| `null`

#### Returns

`void`

***

### setThumbnail()

> **setThumbnail**(`id`, `url`): `void`

Defined in: [ui-react/src/store/types.ts:82](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L82)

设置缩略图

#### Parameters

##### id

`string`

##### url

`string`

#### Returns

`void`

***

### removeAsset()

> **removeAsset**(`id`): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:84](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L84)

删除资产

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### addNode()

> **addNode**(`capability`): `void`

Defined in: [ui-react/src/store/types.ts:87](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L87)

添加工作流节点

#### Parameters

##### capability

`string`

#### Returns

`void`

***

### updateNodeParams()

> **updateNodeParams**(`id`, `params`): `void`

Defined in: [ui-react/src/store/types.ts:89](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L89)

更新节点参数

#### Parameters

##### id

`string`

##### params

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### removeNode()

> **removeNode**(`id`): `void`

Defined in: [ui-react/src/store/types.ts:91](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L91)

删除节点

#### Parameters

##### id

`string`

#### Returns

`void`

***

### selectNode()

> **selectNode**(`id`): `void`

Defined in: [ui-react/src/store/types.ts:93](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L93)

选择节点

#### Parameters

##### id

`string` \| `null`

#### Returns

`void`

***

### setNodeStatus()

> **setNodeStatus**(`id`, `status`, `error?`, `duration?`): `void`

Defined in: [ui-react/src/store/types.ts:95](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L95)

设置节点状态

#### Parameters

##### id

`string`

##### status

[`NodeStatus`](/docs/api/ui-react/src/type-aliases/nodestatus/)

##### error?

`string`

##### duration?

`number`

#### Returns

`void`

***

### moveNode()

> **moveNode**(`from`, `to`): `void`

Defined in: [ui-react/src/store/types.ts:101](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L101)

移动节点到新位置(线性链重排,W10.4)。

#### Parameters

##### from

`number`

源索引(0-based)

##### to

`number`

目标索引(0-based,移动后该节点的新位置)

#### Returns

`void`

***

### insertNodeAt()

> **insertNodeAt**(`index`, `capability`): `void`

Defined in: [ui-react/src/store/types.ts:107](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L107)

在指定位置插入节点(W11.1)。

#### Parameters

##### index

`number`

目标位置(0-based;越界时自动 clamp 到 [0, length])

##### capability

`string`

能力名

#### Returns

`void`

***

### run()

> **run**(): `Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)[]\>

Defined in: [ui-react/src/store/types.ts:110](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L110)

执行工作流

#### Returns

`Promise`\<[`Asset`](/docs/api/schema/src/interfaces/asset/)[]\>

***

### cancelRun()

> **cancelRun**(): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:112](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L112)

取消当前运行(W11.6)

#### Returns

`Promise`\<`void`\>

***

### loadWorkflowTemplate()

> **loadWorkflowTemplate**(`templateNodes`): `void`

Defined in: [ui-react/src/store/types.ts:117](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L117)

应用工作流模板(W11.4):替换当前 nodes 为模板节点序列。

#### Parameters

##### templateNodes

`object`[]

模板节点(capability + 默认 params)

#### Returns

`void`

***

### setStatus()

> **setStatus**(`message`): `void`

Defined in: [ui-react/src/store/types.ts:121](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L121)

设置状态消息

#### Parameters

##### message

`string`

#### Returns

`void`

***

### setError()

> **setError**(`error`): `void`

Defined in: [ui-react/src/store/types.ts:123](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L123)

设置错误

#### Parameters

##### error

`string` \| `null`

#### Returns

`void`

***

### refreshStorageUsage()

> **refreshStorageUsage**(): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:125](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L125)

刷新存储配额使用情况(W6.7)

#### Returns

`Promise`\<`void`\>

***

### refreshHistory()

> **refreshHistory**(`workflowId`): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:127](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L127)

刷新历史栈(W7.1)

#### Parameters

##### workflowId

`string`

#### Returns

`Promise`\<`void`\>

***

### undo()

> **undo**(): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:129](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L129)

撤销一步(W7.1)

#### Returns

`Promise`\<`void`\>

***

### redo()

> **redo**(): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:131](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L131)

重做一步(W7.1)

#### Returns

`Promise`\<`void`\>

***

### jumpToHistory()

> **jumpToHistory**(`index`): `Promise`\<`void`\>

Defined in: [ui-react/src/store/types.ts:133](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L133)

跳转到指定历史条目(W7.1)

#### Parameters

##### index

`number`

#### Returns

`Promise`\<`void`\>

***

### clearWorkflow()

> **clearWorkflow**(): `void`

Defined in: [ui-react/src/store/types.ts:135](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L135)

清空工作流

#### Returns

`void`

***

### selectOutput()

> **selectOutput**(`id`): `void`

Defined in: [ui-react/src/store/types.ts:137](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L137)

选择输出资产(W9.4)

#### Parameters

##### id

`string` \| `null`

#### Returns

`void`

***

### clearOutputs()

> **clearOutputs**(): `void`

Defined in: [ui-react/src/store/types.ts:139](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/store/types.ts#L139)

清空上次输出列表(W9.4/W9.5)

#### Returns

`void`
