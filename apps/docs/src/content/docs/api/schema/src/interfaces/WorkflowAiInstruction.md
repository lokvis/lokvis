---
editUrl: false
next: false
prev: false
title: "WorkflowAiInstruction"
---

Defined in: [schema/src/workflow.ts:137](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L137)

Workflow 的 AI 指令描述(见 docs/AI生态冲击调整方案.md §7.2)。
把 Workflow JSON 转换为 AI Agent 可理解的指令格式,
供 MCP server 在 prompt 模板 / resource 中暴露给 AI 客户端。

## Properties

### instruction

> **instruction**: `string`

Defined in: [schema/src/workflow.ts:139](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L139)

人类可读的指令描述,如 "Execute 2-step workflow: image.resize with {...} → image.compress with {...}"

***

### capabilities

> **capabilities**: `string`[]

Defined in: [schema/src/workflow.ts:141](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L141)

涉及的 Lokvis capability 名(去重)

***

### inputSchema

> **inputSchema**: `object`

Defined in: [schema/src/workflow.ts:143](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L143)

输入参数 JSON Schema(描述 workflow 需要的输入)

***

### example

> **example**: `object`

Defined in: [schema/src/workflow.ts:145](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L145)

示例调用(供 AI 学习调用方式)

#### input

> **input**: `Record`\<`string`, `unknown`\>

#### expectedOutput

> **expectedOutput**: `string`
