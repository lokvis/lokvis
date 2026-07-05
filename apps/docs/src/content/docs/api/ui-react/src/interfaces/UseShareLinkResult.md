---
editUrl: false
next: false
prev: false
title: "UseShareLinkResult"
---

Defined in: [ui-react/src/hooks/useShareLink.ts:103](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useShareLink.ts#L103)

## Methods

### generateShareUrl()

> **generateShareUrl**(): `string` \| `null`

Defined in: [ui-react/src/hooks/useShareLink.ts:108](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useShareLink.ts#L108)

生成分享链接(基于当前 store 中的 nodes)。
返回完整 URL;若 nodes 为空返回 null。

#### Returns

`string` \| `null`

***

### parseShareUrl()

> **parseShareUrl**(`url`): `object`[] \| `null`

Defined in: [ui-react/src/hooks/useShareLink.ts:114](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useShareLink.ts#L114)

从 URL 解析工作流节点。

#### Parameters

##### url

`string`

完整 URL 或仅 search 部分

#### Returns

`object`[] \| `null`

节点数组;无 workflow 参数或解析失败返回 null

***

### loadFromCurrentUrl()

> **loadFromCurrentUrl**(): `boolean`

Defined in: [ui-react/src/hooks/useShareLink.ts:119](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/hooks/useShareLink.ts#L119)

从当前页面 URL 加载工作流(若有 ?workflow=)。

#### Returns

`boolean`

true 表示成功加载并应用到 store
