# @lokvis/cli

Lokvis 命令行工具 —— 在 Node.js 中运行 Lokvis 工作流、列出能力、脚手架插件。

## 安装

```bash
# 全局安装(独立使用)
npm install -g @lokvis/cli

# 或在项目内
pnpm add @lokvis/cli
```

## 命令

```
lokvis <command> [options]

Commands:
  run <workflow.json> [files...]   Run a workflow on the given input files
  capabilities                     List built-in capabilities
  plugin create <name>             Scaffold a new plugin package
  version                          Show CLI version
  help                             Show this help message

Options for `run`:
  -i, --input <path>     Input file (can be repeated; also accepted as positional)
  -o, --output <path>    Write the first output Asset to this file path

Examples:
  lokvis run ./my-workflow.json ./input.png
  lokvis run ./my-workflow.json --input a.png --input b.png --output out.png
  lokvis capabilities
  lokvis plugin create my-plugin
```

## 用法

### `lokvis run` — 在 Node 中跑工作流

`run` 命令默认注入 [`@lokvis/plugin-image/node`](../plugin-image) 的 sharp 引擎(由 [M2.2](../../docs/reports/20260712-task-plan.md) 实装),让以下 5 个图像能力在 Node 中真实可执行:

| Capability | 说明 |
|---|---|
| `image.resize` | 缩放至指定尺寸 |
| `image.compress` | 压缩 / 转格式(quality 降级) |
| `image.convert` | 格式转换(png/webp/jpeg) |
| `image.crop` | 区域裁剪 |
| `image.watermark` | 文字 / 图片水印 |

其余 4 个图像操作(`image.rotate` / `image.flip` / `image.background` / `image.filter`)在 Node 引擎中为 stub,需走浏览器路径(canvas 引擎)。

```bash
# 单输入 → 单输出
lokvis run ./resize.json --input ./input.png --output ./output.png

# 位置参数形式(等价于 --input)
lokvis run ./resize.json ./input.png --output ./output.png

# 不指定 --output 时,WorkflowResult JSON 输出到 stdout
lokvis run ./resize.json ./input.png
```

最小 resize workflow 示例(`resize.json`):

```json
{
  "id": "wf-resize",
  "version": "1.0.0",
  "name": "Resize",
  "description": "Resize image to 1280x720",
  "author": { "id": "cli", "name": "CLI" },
  "category": "image",
  "tags": ["resize"],
  "nodes": [
    {
      "id": "n-resize",
      "type": "transform",
      "capability": "image.resize",
      "params": { "width": 1280, "height": 720, "fit": "cover" }
    }
  ],
  "edges": [],
  "inputs": { "type": "image", "multiple": false },
  "outputs": { "type": "image", "format": "png" }
}
```

### `lokvis capabilities` — 列出内置能力

```bash
lokvis capabilities
# 或简写
lokvis caps
```

输出 40 个内置能力(`image.*` / `pdf.*` / `video.*` / `audio.*` / `ai.*` / `asset.*` / `developer.*`)。

### `lokvis plugin create <name>` — 脚手架新插件

```bash
lokvis plugin create my-plugin
# 指定目标目录
lokvis plugin create my-plugin ./packages/my-plugin
# scoped 名
lokvis plugin create @my-scope/my-plugin
```

在目标目录生成 `package.json` + `tsconfig.json` + `src/index.ts` + `README.md`,基于 `@lokvis/plugin-sdk` 的 `definePlugin` 模板。

## 编程式 API

`@lokvis/cli` 也可作为库导入:

```ts
import { runWorkflow, listCapabilities, createPlugin, runCLI } from '@lokvis/cli';

// 程序式调用 run(等价于 `lokvis run`)
const result = await runWorkflow('./resize.json', ['./input.png'], {
  output: './output.png',
});

// 列出能力
const caps = listCapabilities();

// 在脚本中复用 CLI 入口(直接写 stdout)
await runCLI(['capabilities']);
```

`runWorkflow` 的 `RunOptions`:

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `plugins` | `PluginLoadEntry[]` | `[]` | 额外插件,在默认 image plugin **之后**追加(可覆盖同名能力) |
| `output` | `string` | — | 输出文件路径,把第一个输出 Asset 写入此文件 |
| `injectImagePlugin` | `boolean` | `true` | 是否注入默认 `imageToolsPluginNode`(sharp 引擎);设为 `false` 可禁用 |

## 限制

- `run` 命令的图像能力基于 sharp 引擎,5 个真实操作见上表;rotate/flip/background/filter 需浏览器路径
- Runtime 在 Node 中禁用 OPFS / IndexedDB(`enableOpfs: false, enableIndexedDB: false`),资产存于内存(Memory store)
- 当前未实现 PDF / Video / Audio / AI 引擎(`engine-pdf` / `engine-video` / `engine-audio` / `engine-ai` 均为 stub),对应能力在 `run` 中会抛错

## 相关

- [@lokvis/sdk](../sdk) — 在 Web 应用中嵌入 Lokvis Runtime
- [@lokvis/plugin-image](../plugin-image) — 图像能力插件(浏览器 + Node 双引擎)
- [@lokvis/plugin-sdk](../plugin-sdk) — 插件开发 SDK
- [Lokvis 文档](../../docs) — 完整文档与架构说明
