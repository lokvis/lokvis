---
editUrl: false
next: false
prev: false
title: "SaveWorkflowInput"
---

Defined in: [ui-react/src/hooks/useWorkflows.ts:52](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L52)

保存工作流时的输入

## Properties

### name?

> `optional` **name?**: `string`

Defined in: [ui-react/src/hooks/useWorkflows.ts:54](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L54)

工作流名称(可选,默认取 workflow.name)

***

### workflow

> **workflow**: [`Workflow`](/docs/api/schema/src/interfaces/workflow/)

Defined in: [ui-react/src/hooks/useWorkflows.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L56)

完整 Workflow 定义

***

### id?

> `optional` **id?**: `string`

Defined in: [ui-react/src/hooks/useWorkflows.ts:58](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useWorkflows.ts#L58)

若指定则更新该 id 的槽位,否则新增
