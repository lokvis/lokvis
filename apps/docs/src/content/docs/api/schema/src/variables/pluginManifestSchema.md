---
editUrl: false
next: false
prev: false
title: "pluginManifestSchema"
---

> `const` **pluginManifestSchema**: `ZodObject`\<\{ `name`: `ZodString`; `version`: `ZodString`; `description`: `ZodString`; `author`: `ZodString`; `license`: `ZodString`; `main`: `ZodString`; `icon`: `ZodOptional`\<`ZodString`\>; `capabilities`: `ZodArray`\<`ZodString`, `"many"`\>; `engines`: `ZodObject`\<\{ `lokvis-runtime`: `ZodString`; \}, `"strip"`, `ZodTypeAny`, \{ `lokvis-runtime`: `string`; \}, \{ `lokvis-runtime`: `string`; \}\>; `permissions`: `ZodArray`\<`ZodString`, `"many"`\>; \}, `"strip"`, `ZodTypeAny`, \{ `name`: `string`; `version`: `string`; `description`: `string`; `author`: `string`; `license`: `string`; `main`: `string`; `icon?`: `string`; `capabilities`: `string`[]; `engines`: \{ `lokvis-runtime`: `string`; \}; `permissions`: `string`[]; \}, \{ `name`: `string`; `version`: `string`; `description`: `string`; `author`: `string`; `license`: `string`; `main`: `string`; `icon?`: `string`; `capabilities`: `string`[]; `engines`: \{ `lokvis-runtime`: `string`; \}; `permissions`: `string`[]; \}\>

Defined in: [schema/src/validators.ts:99](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/validators.ts#L99)
