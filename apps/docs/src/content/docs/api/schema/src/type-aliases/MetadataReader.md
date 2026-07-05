---
editUrl: false
next: false
prev: false
title: "MetadataReader"
---

> **MetadataReader**\<`T`\> = (`asset`) => `Promise`\<`T` \| `null`\>

Defined in: [schema/src/plugin.ts:83](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/plugin.ts#L83)

元数据读取函数(依赖反转)。

某些 Plugin 能力本质是"元数据查询"而非"资产变换"(如 EXIF 读取:
Blob → ExifData),既不符合 Engine 层 Blob↔Blob 约束,也不符合
CapabilityImplementation 的 Asset[]→Asset[] 契约。这类能力通过
MetadataReader 注册:Plugin 提供读取函数,Runtime 持有引用并按名调用。

与 registerCapability 的区别:
- registerCapability:注册变换能力(Asset→Asset),走 WorkflowExecutor
- registerMetadataReader:注册查询函数(Asset→T),走 Runtime 直接调用

优点(相对 Capability execute + data Asset 序列化方案):
- 无需创建临时 data Asset(避免手动 removeAsset 清理 / 泄漏)
- 无 JSON marshal/unmarshal 开销
- 类型直接透传(ExifData),无需序列化

## Type Parameters

### T

`T` = `unknown`

## Parameters

### asset

[`Asset`](/docs/api/schema/src/interfaces/asset/)

输入资产

## Returns

`Promise`\<`T` \| `null`\>

读取结果;无数据 / 解析失败返回 null
