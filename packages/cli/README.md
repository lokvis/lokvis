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
  validate <workflow.json>         Validate a workflow file without executing
  list [dir]                       List workflow files in a directory
  capabilities                     List built-in capabilities
  plugin create <name>             Scaffold a new plugin package
  version                          Show CLI version
  help                             Show this help message

Options for `run`:
  -i, --input <path>     Input file (can be repeated; also accepted as positional)
  -o, --output <path>    Write the first output Asset to this file path

Options for `validate`:
  --max-steps <n>        Max node count (default 5, matching MAX_WORKFLOW_STEPS)
  --json                 Output result as JSON (for CI)

Options for `list`:
  --all                  Include invalid .json files (showing first error)
  --json                 Output result as JSON array (for CI)
  --max-depth <n>        Max recursion depth (default unlimited)

Options for `plugin create`:
  --author <name>        Plugin author (default 'anonymous')
  --description <text>   Plugin description

Examples:
  lokvis run ./my-workflow.json ./input.png
  lokvis run ./my-workflow.json --input a.png --input b.png --output out.png
  lokvis validate ./my-workflow.json
  lokvis validate ./my-workflow.json --json
  lokvis list ./workflows
  lokvis list . --all --json
  lokvis capabilities
  lokvis plugin create my-plugin --author alice --description "A cool plugin"
```

## 用法

### `lokvis run` — 在 Node 中跑工作流

`run` 命令默认注入 [`@lokvis/plugin-image/node`](../plugin-image) 的 sharp 引擎(由 [M2.2](../../docs/reports/archive/20260712-task-plan.md) 实装),让以下 5 个图像能力在 Node 中真实可执行:

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

### `lokvis validate <workflow.json>` — 校验 workflow 文件

不实际执行,仅做语法/结构/DAG 校验。适合 CI 流水线、编辑器预检场景。

```bash
# 基础校验(打印成功/失败 + 摘要)
lokvis validate ./my-workflow.json

# JSON 输出(便于 CI 解析)
lokvis validate ./my-workflow.json --json

# 自定义节点数上限(默认 5,即 MAX_WORKFLOW_STEPS)
lokvis validate ./my-workflow.json --max-steps 10
```

校验项:
1. JSON 解析合法性
2. Zod 形状校验(字段类型/必填/枚举)
3. 结构层校验(保留字 `__input__` / 唯一性 / edge 引用 / DAG 无环)
4. 节点数上限(可选,默认 `MAX_WORKFLOW_STEPS = 5`)

退出码:校验通过 `0`,失败 `1`(便于 CI 检测)。

### `lokvis list [dir]` — 列出 workflow 文件

递归扫描指定目录(默认 cwd)下的 `*.json`,识别哪些是合法 workflow。

```bash
# 列出当前目录下所有 workflow
lokvis list

# 指定目录
lokvis list ./workflows

# 包含未通过校验的 .json(显示第一条错误)
lokvis list . --all

# JSON 输出
lokvis list ./workflows --json

# 限制递归深度
lokvis list . --max-depth 3
```

扫描策略:
- 跳过 `node_modules` / `dist` / `build` / `.git` / `.turbo` / `coverage` 等目录
- 跳过符号链接(避免环)
- 默认仅显示通过校验的 workflow;`--all` 同时显示无效 `.json` 及错误
- 结果按相对路径字典序排序

### `lokvis plugin create <name>` — 脚手架新插件

```bash
lokvis plugin create my-plugin
# 指定目标目录
lokvis plugin create my-plugin ./packages/my-plugin
# scoped 名
lokvis plugin create @my-scope/my-plugin
# 指定作者与描述
lokvis plugin create my-plugin --author alice --description "A cool plugin"
```

在目标目录生成 `package.json` + `tsconfig.json` + `src/index.ts` + `README.md`,基于 `@lokvis/plugin-sdk` 的 `definePlugin` 模板。

插件名校验(S1 P1:zod 化):
- 普通名:`my-plugin`(lowercase kebab-case,允许 `a-z` / `0-9` / `-`)
- scoped 名:`@scope/name`(npm scoped package 形式)

## 编程式 API

`@lokvis/cli` 也可作为库导入:

```ts
import {
  runWorkflow,
  validateWorkflowFile,
  listWorkflows,
  listCapabilities,
  createPlugin,
  runCLI,
  validateWorkflow,
} from '@lokvis/cli';

// 程序式调用 run(等价于 `lokvis run`)
const runResult = await runWorkflow('./resize.json', ['./input.png'], {
  output: './output.png',
});

// 校验 workflow 文件(等价于 `lokvis validate`)
const validateResult = await validateWorkflowFile('./my-workflow.json', { maxSteps: 5 });
if (!validateResult.valid) {
  for (const err of validateResult.errors) console.error(err.path, err.message);
}

// 直接校验 workflow 对象(无需读文件,适合从 HTTP / stdin 拿到 JSON)
const parsed = validateWorkflow(workflowJsonFromHttp);
if (!parsed.success) {
  throw new Error(`Invalid: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
}

// 列出目录下的 workflow 文件(等价于 `lokvis list`)
const entries = await listWorkflows('./workflows', { includeInvalid: true });

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

`validateWorkflowFile` 的 `ValidateOptions`:

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `maxSteps` | `number` | `MAX_WORKFLOW_STEPS` (5) | 最大节点数限制 |
| `json` | `boolean` | `false` | 仅影响 CLI 输出格式,编程式 API 调用可忽略 |

`listWorkflows` 的 `ListOptions`:

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `includeInvalid` | `boolean` | `false` | 是否包含未通过校验的 `.json` 文件 |
| `json` | `boolean` | `false` | 仅影响 CLI 输出格式,编程式 API 调用可忽略 |
| `maxDepth` | `number` | `Infinity` | 最大递归深度 |

## 限制

- `run` 命令的图像能力基于 sharp 引擎,5 个真实操作见上表;rotate/flip/background/filter 需浏览器路径
- Runtime 在 Node 中禁用 OPFS / IndexedDB(`enableOpfs: false, enableIndexedDB: false`),资产存于内存(Memory store)
- 当前未实现 PDF / Video / Audio / AI 引擎(`engine-pdf` / `engine-video` / `engine-audio` / `engine-ai` 均为 stub),对应能力在 `run` 中会抛错

## 相关

- [@lokvis/sdk](../sdk) — 在 Web 应用中嵌入 Lokvis Runtime
- [@lokvis/plugin-image](../plugin-image) — 图像能力插件(浏览器 + Node 双引擎)
- [@lokvis/plugin-sdk](../plugin-sdk) — 插件开发 SDK
- [Lokvis 文档](../../docs) — 完整文档与架构说明
