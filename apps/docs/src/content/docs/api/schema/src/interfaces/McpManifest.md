---
editUrl: false
next: false
prev: false
title: "McpManifest"
---

Defined in: [schema/src/mcp.ts:36](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/mcp.ts#L36)

MCP server manifest:Runtime 当前可被 MCP 暴露的能力概览

## Properties

### serverName

> **serverName**: `string`

Defined in: [schema/src/mcp.ts:38](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/mcp.ts#L38)

MCP server 名称,固定为 `lokvis`

***

### version

> **version**: `string`

Defined in: [schema/src/mcp.ts:40](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/mcp.ts#L40)

Runtime 版本

***

### tools

> **tools**: [`McpToolManifest`](/docs/api/schema/src/interfaces/mcptoolmanifest/)[]

Defined in: [schema/src/mcp.ts:42](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/mcp.ts#L42)

暴露的 tools 列表

***

### resources

> **resources**: [`McpResourceManifest`](/docs/api/schema/src/interfaces/mcpresourcemanifest/)[]

Defined in: [schema/src/mcp.ts:44](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/mcp.ts#L44)

暴露的 resources 列表
