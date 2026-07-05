---
editUrl: false
next: false
prev: false
title: "validateWorkflow"
---

> **validateWorkflow**(`data`, `options?`): `SafeParseError`\<\{ `$schema?`: `string`; `id`: `string`; `version`: `string`; `name`: `string`; `description`: `string`; `author`: \{ `id`: `string`; `name`: `string`; \}; `category`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"data"` \| `"ai"` \| `"developer"` \| `"ecommerce"` \| `"content-creation"` \| `"other"`; `tags`: `string`[]; `nodes`: `object`[]; `edges`: `object`[]; `inputs`: \{ `type`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"text"` \| `"data"` \| `"unknown"`; `multiple`: `boolean`; `maxCount?`: `number`; `accept?`: `string`[]; \}; `outputs`: \{ `type`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"text"` \| `"data"` \| `"unknown"` \| `"archive"`; `format?`: `string`; \}; `official?`: `boolean`; `createdAt?`: `number`; `updatedAt?`: `number`; \}\> \| \{ `success`: `false`; `error`: \{ `issues`: `object`[]; \}; `data?`: `undefined`; \} \| \{ `error?`: `undefined`; `success`: `true`; `data`: \{ `$schema?`: `string`; `id`: `string`; `version`: `string`; `name`: `string`; `description`: `string`; `author`: \{ `id`: `string`; `name`: `string`; \}; `category`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"data"` \| `"ai"` \| `"developer"` \| `"ecommerce"` \| `"content-creation"` \| `"other"`; `tags`: `string`[]; `nodes`: `object`[]; `edges`: `object`[]; `inputs`: \{ `type`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"text"` \| `"data"` \| `"unknown"`; `multiple`: `boolean`; `maxCount?`: `number`; `accept?`: `string`[]; \}; `outputs`: \{ `type`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"text"` \| `"data"` \| `"unknown"` \| `"archive"`; `format?`: `string`; \}; `official?`: `boolean`; `createdAt?`: `number`; `updatedAt?`: `number`; \}; \}

Defined in: [schema/src/validators.ts:141](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/validators.ts#L141)

## Parameters

### data

`unknown`

### options?

[`ValidateWorkflowOptions`](/docs/api/schema/src/interfaces/validateworkflowoptions/)

## Returns

`SafeParseError`\<\{ `$schema?`: `string`; `id`: `string`; `version`: `string`; `name`: `string`; `description`: `string`; `author`: \{ `id`: `string`; `name`: `string`; \}; `category`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"data"` \| `"ai"` \| `"developer"` \| `"ecommerce"` \| `"content-creation"` \| `"other"`; `tags`: `string`[]; `nodes`: `object`[]; `edges`: `object`[]; `inputs`: \{ `type`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"text"` \| `"data"` \| `"unknown"`; `multiple`: `boolean`; `maxCount?`: `number`; `accept?`: `string`[]; \}; `outputs`: \{ `type`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"text"` \| `"data"` \| `"unknown"` \| `"archive"`; `format?`: `string`; \}; `official?`: `boolean`; `createdAt?`: `number`; `updatedAt?`: `number`; \}\> \| \{ `success`: `false`; `error`: \{ `issues`: `object`[]; \}; `data?`: `undefined`; \} \| \{ `error?`: `undefined`; `success`: `true`; `data`: \{ `$schema?`: `string`; `id`: `string`; `version`: `string`; `name`: `string`; `description`: `string`; `author`: \{ `id`: `string`; `name`: `string`; \}; `category`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"data"` \| `"ai"` \| `"developer"` \| `"ecommerce"` \| `"content-creation"` \| `"other"`; `tags`: `string`[]; `nodes`: `object`[]; `edges`: `object`[]; `inputs`: \{ `type`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"text"` \| `"data"` \| `"unknown"`; `multiple`: `boolean`; `maxCount?`: `number`; `accept?`: `string`[]; \}; `outputs`: \{ `type`: `"image"` \| `"video"` \| `"audio"` \| `"pdf"` \| `"text"` \| `"data"` \| `"unknown"` \| `"archive"`; `format?`: `string`; \}; `official?`: `boolean`; `createdAt?`: `number`; `updatedAt?`: `number`; \}; \}
