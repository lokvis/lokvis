---
editUrl: false
next: false
prev: false
title: "createBlobCapabilityImpl"
---

> **createBlobCapabilityImpl**(`options`, `ctx`): [`CapabilityImplementation`](/docs/api/schema/src/interfaces/capabilityimplementation/)

Defined in: [plugin-sdk/src/index.ts:152](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-sdk/src/index.ts#L152)

创建单输入→单输出的 Blob 能力实现(长期方案:消除 plugin-* 重复)。

封装"取 blob → 调 operation → 派生 metadata → createAsset → 进度/取消"
五步样板。plugin-image / plugin-video / plugin-pdf(single kind)共享此工厂,
各自只提供 operation 函数与 isStub 检测,不再重复 wrapAsImplementation。

merge(N→1) / split(1→N) 形态不同,仍由 plugin-pdf 自行实现。

## Parameters

### options

[`BlobCapabilityOptions`](/docs/api/plugin-sdk/src/interfaces/blobcapabilityoptions/)

### ctx

[`PluginContext`](/docs/api/schema/src/interfaces/plugincontext/)

## Returns

[`CapabilityImplementation`](/docs/api/schema/src/interfaces/capabilityimplementation/)
