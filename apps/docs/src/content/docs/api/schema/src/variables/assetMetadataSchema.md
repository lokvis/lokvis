---
editUrl: false
next: false
prev: false
title: "assetMetadataSchema"
---

> `const` **assetMetadataSchema**: `ZodObject`\<\{ `mimeType`: `ZodString`; `size`: `ZodNumber`; `dimensions`: `ZodOptional`\<`ZodObject`\<\{ `width`: `ZodNumber`; `height`: `ZodNumber`; \}, `"strip"`, `ZodTypeAny`, \{ `width`: `number`; `height`: `number`; \}, \{ `width`: `number`; `height`: `number`; \}\>\>; `duration`: `ZodOptional`\<`ZodNumber`\>; `pages`: `ZodOptional`\<`ZodNumber`\>; `format`: `ZodString`; \}, `"strip"`, `ZodTypeAny`, \{ `mimeType`: `string`; `size`: `number`; `dimensions?`: \{ `width`: `number`; `height`: `number`; \}; `duration?`: `number`; `pages?`: `number`; `format`: `string`; \}, \{ `mimeType`: `string`; `size`: `number`; `dimensions?`: \{ `width`: `number`; `height`: `number`; \}; `duration?`: `number`; `pages?`: `number`; `format`: `string`; \}\>

Defined in: [schema/src/validators.ts:45](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/validators.ts#L45)
