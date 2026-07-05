---
editUrl: false
next: false
prev: false
title: "definePlugin"
---

> **definePlugin**(`config`, `installer?`): `object`

Defined in: [plugin-sdk/src/index.ts:73](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/plugin-sdk/src/index.ts#L73)

定义一个 Lokvis Plugin

## Parameters

### config

[`PluginConfig`](/docs/api/schema/src/interfaces/pluginconfig/)

### installer?

(`ctx`) => `void` \| `Promise`\<`void`\>

## Returns

`object`

### config

> **config**: [`PluginConfig`](/docs/api/schema/src/interfaces/pluginconfig/)

### install

> **install**: [`PluginInstaller`](/docs/api/schema/src/type-aliases/plugininstaller/)

## Example

```ts
export default definePlugin({
  name: 'lokvis-image-tools',
  version: '1.0.0',
  capabilities: [
    {
      name: 'image.resize',
      description: 'Resize image to specified dimensions',
      inputTypes: ['image'],
      outputTypes: ['image'],
      params: [
        { name: 'width', type: 'number', required: false },
        { name: 'height', type: 'number', required: false },
        { name: 'fit', type: 'enum', values: ['cover', 'contain', 'fill'] }
      ],
      performance: 'fast'
    }
  ],
  engine: 'squoosh'
});
```
