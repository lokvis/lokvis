---
editUrl: false
next: false
prev: false
title: "Workflow"
---

Defined in: [schema/src/workflow.ts:86](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L86)

完整 Workflow 定义

## Properties

### $schema?

> `optional` **$schema?**: `string`

Defined in: [schema/src/workflow.ts:88](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L88)

Schema URL

***

### id

> **id**: `string`

Defined in: [schema/src/workflow.ts:90](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L90)

Workflow 唯一 ID

***

### version

> **version**: `string`

Defined in: [schema/src/workflow.ts:92](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L92)

版本号

***

### name

> **name**: `string`

Defined in: [schema/src/workflow.ts:94](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L94)

工作流名称

***

### description

> **description**: `string`

Defined in: [schema/src/workflow.ts:96](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L96)

描述

***

### author

> **author**: [`WorkflowAuthor`](/docs/api/schema/src/interfaces/workflowauthor/)

Defined in: [schema/src/workflow.ts:98](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L98)

作者

***

### category

> **category**: [`WorkflowCategory`](/docs/api/schema/src/type-aliases/workflowcategory/)

Defined in: [schema/src/workflow.ts:100](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L100)

分类

***

### tags

> **tags**: `string`[]

Defined in: [schema/src/workflow.ts:102](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L102)

标签

***

### nodes

> **nodes**: [`WorkflowNode`](/docs/api/schema/src/interfaces/workflownode/)[]

Defined in: [schema/src/workflow.ts:104](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L104)

节点列表

***

### edges

> **edges**: [`WorkflowEdge`](/docs/api/schema/src/interfaces/workflowedge/)[]

Defined in: [schema/src/workflow.ts:106](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L106)

边列表（线性链）

***

### inputs

> **inputs**: [`WorkflowInput`](/docs/api/schema/src/interfaces/workflowinput/)

Defined in: [schema/src/workflow.ts:108](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L108)

输入定义

***

### outputs

> **outputs**: [`WorkflowOutput`](/docs/api/schema/src/interfaces/workflowoutput/)

Defined in: [schema/src/workflow.ts:110](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L110)

输出定义

***

### official?

> `optional` **official?**: `boolean`

Defined in: [schema/src/workflow.ts:112](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L112)

是否为官方工作流

***

### createdAt?

> `optional` **createdAt?**: `number`

Defined in: [schema/src/workflow.ts:114](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L114)

创建时间

***

### updatedAt?

> `optional` **updatedAt?**: `number`

Defined in: [schema/src/workflow.ts:116](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L116)

更新时间
