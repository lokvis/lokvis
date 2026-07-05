---
editUrl: false
next: false
prev: false
title: "StreamingImageOperation"
---

Defined in: [engine-image/src/types.ts:177](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L177)

流式图像操作接口(供未来 WASM / WebCodecs 引擎实现)。

约定:输入是一个 ReadableStream<Blob>(每个 Blob 是一个 tile 的编码数据),
输出是 AsyncIterable<ImageChunk>(处理后的分片)。
主线程可边接收边拼合,无需等待整张图处理完毕。

canvas 引擎因 API 限制无法真正流式,改用 tile-based 同步处理近似。

> **StreamingImageOperation**(`input`, `params`, `signal?`): `AsyncIterable`\<[`ImageChunk`](/docs/api/engine-image/src/interfaces/imagechunk/)\>

Defined in: [engine-image/src/types.ts:178](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/engine-image/src/types.ts#L178)

流式图像操作接口(供未来 WASM / WebCodecs 引擎实现)。

约定:输入是一个 ReadableStream<Blob>(每个 Blob 是一个 tile 的编码数据),
输出是 AsyncIterable<ImageChunk>(处理后的分片)。
主线程可边接收边拼合,无需等待整张图处理完毕。

canvas 引擎因 API 限制无法真正流式,改用 tile-based 同步处理近似。

## Parameters

### input

`ReadableStream`\<`Blob`\>

### params

`Record`\<`string`, `unknown`\>

### signal?

`AbortSignal`

## Returns

`AsyncIterable`\<[`ImageChunk`](/docs/api/engine-image/src/interfaces/imagechunk/)\>
