---
editUrl: false
next: false
prev: false
title: "McpToolManifest"
---

Defined in: [schema/src/mcp.ts:12](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/mcp.ts#L12)

单个 MCP tool 的描述(不启动 server,仅描述可用能力)

## Properties

### name

> **name**: `string`

Defined in: [schema/src/mcp.ts:14](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/mcp.ts#L14)

tool 名称,约定为 `lokvis_${capability.replace(/\./g, '_')}`

***

### description

> **description**: `string`

Defined in: [schema/src/mcp.ts:16](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/mcp.ts#L16)

tool 描述,供 AI 客户端理解用途

***

### inputSchema

> **inputSchema**: `object`

Defined in: [schema/src/mcp.ts:18](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/mcp.ts#L18)

输入参数 JSON Schema

***

### capabilities

> **capabilities**: `string`[]

Defined in: [schema/src/mcp.ts:20](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/mcp.ts#L20)

依赖的 Lokvis capability 名
