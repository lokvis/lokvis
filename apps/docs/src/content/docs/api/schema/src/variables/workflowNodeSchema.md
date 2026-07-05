---
editUrl: false
next: false
prev: false
title: "workflowNodeSchema"
---

> `const` **workflowNodeSchema**: `ZodEffects`\<`ZodObject`\<\{ `id`: `ZodString`; `type`: `ZodEnum`\<\[`"load"`, `"transform"`, `"export"`\]\>; `capability`: `ZodOptional`\<`ZodString`\>; `params`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; `label`: `ZodOptional`\<`ZodString`\>; \}, `"strip"`, `ZodTypeAny`, \{ `id`: `string`; `type`: `"load"` \| `"transform"` \| `"export"`; `capability?`: `string`; `params?`: `Record`\<`string`, `unknown`\>; `label?`: `string`; \}, \{ `id`: `string`; `type`: `"load"` \| `"transform"` \| `"export"`; `capability?`: `string`; `params?`: `Record`\<`string`, `unknown`\>; `label?`: `string`; \}\>, \{ `id`: `string`; `type`: `"load"` \| `"transform"` \| `"export"`; `capability?`: `string`; `params?`: `Record`\<`string`, `unknown`\>; `label?`: `string`; \}, \{ `id`: `string`; `type`: `"load"` \| `"transform"` \| `"export"`; `capability?`: `string`; `params?`: `Record`\<`string`, `unknown`\>; `label?`: `string`; \}\>

Defined in: [schema/src/validators.ts:56](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/validators.ts#L56)
