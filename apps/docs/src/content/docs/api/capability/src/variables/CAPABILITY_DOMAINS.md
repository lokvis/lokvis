---
editUrl: false
next: false
prev: false
title: "CAPABILITY_DOMAINS"
---

> `const` **CAPABILITY\_DOMAINS**: readonly \[`"asset"`, `"image"`, `"video"`, `"audio"`, `"pdf"`, `"text"`, `"data"`, `"ai"`, `"developer"`\]

Defined in: [capability/src/names.ts:9](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/capability/src/names.ts#L9)

标准能力命名空间与命名约定

命名规则：`<domain>.<action>`，例如 `image.resize`。
- domain：能力所属领域，与 AssetType 对齐或为 `asset`/`ai` 等横切领域
- action：具体动作，动词或动词短语
