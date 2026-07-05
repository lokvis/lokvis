---
editUrl: false
next: false
prev: false
title: "imageToolsPlugin"
---

> **imageToolsPlugin**(): `object`

Defined in: [plugin-image/src/plugin.ts:38](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-image/src/plugin.ts#L38)

创建图像工具插件

## Returns

`object`

### config

> **config**: [`PluginConfig`](/docs/api/schema/src/interfaces/pluginconfig/)

### install

> **install**: [`PluginInstaller`](/docs/api/schema/src/type-aliases/plugininstaller/)

## Example

```ts
import { createLokvis } from '@lokvis/sdk';
import { imageToolsPlugin } from '@lokvis/plugin-image';

const lokvis = await createLokvis({
  plugins: [imageToolsPlugin()],
});
```
