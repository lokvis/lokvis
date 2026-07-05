---
editUrl: false
next: false
prev: false
title: "validatePluginManifest"
---

> **validatePluginManifest**(`data`): `SafeParseReturnType`\<\{ `name`: `string`; `version`: `string`; `description`: `string`; `author`: `string`; `license`: `string`; `main`: `string`; `icon?`: `string`; `capabilities`: `string`[]; `engines`: \{ `lokvis-runtime`: `string`; \}; `permissions`: `string`[]; \}, \{ `name`: `string`; `version`: `string`; `description`: `string`; `author`: `string`; `license`: `string`; `main`: `string`; `icon?`: `string`; `capabilities`: `string`[]; `engines`: \{ `lokvis-runtime`: `string`; \}; `permissions`: `string`[]; \}\>

Defined in: [schema/src/validators.ts:361](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/validators.ts#L361)

校验 Plugin Manifest

## Parameters

### data

`unknown`

## Returns

`SafeParseReturnType`\<\{ `name`: `string`; `version`: `string`; `description`: `string`; `author`: `string`; `license`: `string`; `main`: `string`; `icon?`: `string`; `capabilities`: `string`[]; `engines`: \{ `lokvis-runtime`: `string`; \}; `permissions`: `string`[]; \}, \{ `name`: `string`; `version`: `string`; `description`: `string`; `author`: `string`; `license`: `string`; `main`: `string`; `icon?`: `string`; `capabilities`: `string`[]; `engines`: \{ `lokvis-runtime`: `string`; \}; `permissions`: `string`[]; \}\>
