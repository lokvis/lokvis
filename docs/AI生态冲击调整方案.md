# Lokvis Open · AI 生态冲击调整方案

> **文档版本**：v1.0
> **发布日期**：2026-07-01
> **触发事件**：基于 [lokvis-cloud/docs/06-AI生态冲击与应对策略.md](../../lokvis-cloud/docs/06-AI生态冲击与应对策略.md) 的战略反思，同步调整 lokvis-open 仓库的设计与任务规划
> **目标**：将"成为 AI 时代的本地处理引擎"战略落地为 open 侧的具体设计、包结构、API 与任务调整
> **配套**：[PROJECT_PLAN.md](./PROJECT_PLAN.md)、[apps/docs](../apps/docs/src/content/docs/) 文档站

---

## 一、背景与战略重新定位

### 1.1 触发原因

2026 年 AI 生态发生结构性变化，对 Lokvis 原有规划形成实质性威胁：

| 变化 | 影响 |
|---|---|
| MCP（Model Context Protocol）成为事实标准 | 自建 Plugin SDK 生态价值被稀释 |
| Claude Skills Directory 上线（Notion/Figma/Canva 集成） | Marketplace 货币化逻辑不成立 |
| AI Agent 自主编排能力增强 | 一次性简单任务被替代 |
| AI 直接处理文件能力增强 | 工具类搜索流量下降 |

详细分析见 [cloud 仓库 06 文档](../../lokvis-cloud/docs/06-AI生态冲击与应对策略.md)。

### 1.2 新战略定位

**原定位**：
> "本地优先的文件处理与工作流平台"

**新定位**：
> **"AI 时代的本地处理引擎 —— 让 AI Agent 安全、免费、批量地处理你的文件"**

**核心转变**：
- 从"替代 AI"转向"增强 AI"
- 从"独立工具平台"转向"AI 生态的本地外挂"
- 从"自建 Plugin 生态"转向"拥抱 MCP 标准"

### 1.3 open 侧的三个角色

在新战略下，lokvis-open 承担三个角色：

| 角色 | 职责 | 对应包 |
|---|---|---|
| **本地处理引擎** | 浏览器内 WASM/Canvas 处理能力 | `engine-*`、`plugin-*`、`runtime` |
| **MCP 能力提供方** | 把本地能力包装为 MCP server，供 AI 调用 | **新增 `@lokvis/mcp-server`** |
| **AI 辅助 workflow 设计** | AI 生成/优化 workflow，但执行仍确定性 | `engine-ai`、`runtime` |

---

## 二、影响分析总览

### 2.1 影响矩阵

| open 侧组件 | 影响程度 | 调整方向 | 优先级 |
|---|---|---|---|
| `packages/plugin-sdk` | 🔴 高 | 定位降级为"兼容层"，不再是生态核心 | P1 → P3 |
| `packages/sdk` | 🟡 中 | 新增 `toMcpServer()` 能力暴露 API | P0 |
| `packages/engine-ai` | 🟡 中 | 定位明确为"AI 辅助 workflow 设计" | 维持 P2 |
| `packages/runtime` | 🟢 低 | 无需修改（MCP server 在上层） | — |
| `packages/capability` | 🟢 低 | 增加 MCP 兼容性元数据（可选） | P2 |
| `packages/schema` | 🟢 低 | Workflow 支持导出为 AI 指令格式 | P2 |
| **新增 `packages/mcp-server`** | 🔴 高 | 核心新包，open 侧 MCP 暴露层 | **Phase 2 P0** |
| `apps/web` | 🟡 中 | 营销页面 + SEO 关键词调整 | P0 |
| `apps/docs` | 🟡 中 | 新增 MCP Integration 页面 + 更新 plugins/roadmap | P0 |
| `apps/playground` | 🟢 低 | 增加 MCP server 演示 | P2 |
| `examples/` | 🟡 中 | 新增 MCP 集成示例 | P1 |
| PROJECT_PLAN | 🔴 高 | 任务优先级与新增任务调整 | P0 |

### 2.2 Phase 1 vs Phase 2 职责划分

| 能力 | Phase 1（open） | Phase 2（open） |
|---|---|---|
| MCP server 设计 | W11-W12 接口设计（Buffer） | 实现 `@lokvis/mcp-server` 包 |
| Plugin SDK | Alpha 预览（P1，教学性质） | **不发布 v1**，改为 MCP 优先 |
| engine-ai | 维持 stub | 实现 cloudProxyEngine 接口 |
| Workflow 导出 | JSON 导入导出（维持） | 支持导出为 Claude Skill 指令 |
| 营销定位 | 突出"AI 做不到的 6 件事" | MCP server 发布营销 |

---

## 三、核心设计：`@lokvis/mcp-server` 包

### 3.1 设计目标

把 Lokvis Runtime 的能力包装为 MCP server，让 Claude/ChatGPT/Cursor 等 AI 客户端通过 MCP 协议直接调用 Lokvis 的本地处理能力。

### 3.2 架构定位

```
┌─────────────────────────────────────────────────┐
│ AI 客户端（Claude Desktop / ChatGPT / Cursor）   │
└────────────────────┬────────────────────────────┘
                     │ MCP 协议（JSON-RPC over stdio）
                     ▼
┌─────────────────────────────────────────────────┐
│ @lokvis/mcp-server（Node.js 进程）               │
│  - MCP server（tools/resources/prompts 注册）    │
│  - ToolRouter：浏览器优先，Node 降级             │
└──────┬──────────────────────────────────┬───────┘
       │ WebSocket（ws://localhost:7890）  │ 直接调用
       ▼                                  ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ 浏览器 Tab（lokvis.app）  │  │ Node.js Engine Adapter   │
│  - Lokvis Runtime         │  │  - sharp（image 降级）    │
│  - WASM/Canvas/OPFS       │  │  - pdf-lib（pdf）        │
│  - 完整能力               │  │  - 降级模式              │
└──────────────────────────┘  └──────────────────────────┘
```

### 3.3 核心矛盾与解决方案

**核心矛盾**：MCP 协议要求 server 能被 AI 客户端"发现并连接"（stdio 或 HTTP/SSE），但浏览器沙箱不能监听端口、不能访问 stdio、不能 spawn 子进程。**浏览器内的 Lokvis Runtime 无法直接作为 MCP server**，必须有一个 Node.js 桥接层。

**五种架构对比**（详见 [附录 A：MCP 传输架构方案对比](#附录-a-mcp-传输架构方案对比)）：

| 架构 | 描述 | 推荐度 |
|---|---|---|
| A. Node Bridge + 浏览器 Runtime | Node.js 桥接 + WebSocket 连浏览器 | ★★★★★ |
| B. 纯 Node.js MCP Server | sharp 替代 Canvas，无浏览器 | ★★★ |
| C. 浏览器扩展 + Native Messaging | Chrome Extension 桥接 | ★★★★ |
| D. Service Worker + Tunnel | 公网 URL 转发到浏览器 | ★★ |
| **E. 混合模式（A+B）** | **浏览器优先，Node 降级** | **★★★★★ 推荐** |

### 3.4 运行模式（混合架构 E）

#### 模式 1：浏览器连接模式（完整能力）

用户打开了 `lokvis.app` 浏览器 Tab：

```
Claude Desktop
    │ stdio (JSON-RPC)
    ▼
@lokvis/mcp-server (Node.js)
    │ WebSocket (ws://localhost:7890)
    ▼
浏览器 Tab (lokvis.app)
    │ 内部调用
    ▼
Lokvis Runtime (WASM/Canvas/OPFS)
```

**工作流程**：
1. 用户打开 `lokvis.app`，页面加载后主动连接 `ws://localhost:7890`
2. `@lokvis/mcp-server` 启动时同时开启 WebSocket server（端口 7890）
3. 浏览器作为 WebSocket client 连接
4. AI 客户端调用 tool → MCP server → WebSocket 转发到浏览器 → Runtime 执行 → 原路返回

**关键代码**（Bridge 端）：

```typescript
// packages/mcp-server/src/adapters/browser-bridge.ts
import { WebSocketServer } from 'ws';

export class BrowserBridge {
  private wss: WebSocketServer;
  private conn: WebSocket | null = null;

  constructor(port = 7890) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws, req) => {
      // 安全校验：仅接受来自 lokvis.app 的连接（通过 origin 头）
      if (!req.headers.origin?.includes('lokvis.app')) {
        ws.close(1008, 'Unauthorized origin');
        return;
      }
      this.conn = ws;
      console.error('[lokvis] Browser runtime connected');
    });
  }

  async callTool(tool: string, params: unknown): Promise<unknown> {
    if (!this.conn) throw new Error('Browser not connected. Open lokvis.app first.');
    const id = crypto.randomUUID();
    const result = await new Promise((resolve, reject) => {
      const handler = (data: string) => {
        const msg = JSON.parse(data);
        if (msg.id === id) {
          this.conn!.off('message', handler);
          msg.error ? reject(new Error(msg.error)) : resolve(msg.result);
        }
      };
      this.conn!.on('message', handler);
      this.conn!.send(JSON.stringify({ id, type: 'call_tool', tool, params }));
    });
    return result;
  }

  isConnected(): boolean { return this.conn !== null; }
}
```

**关键代码**（浏览器端）：

```typescript
// packages/mcp-browser-client/src/index.ts
export async function connectToMcpBridge(runtime: LokvisRuntime) {
  const ws = new WebSocket('ws://localhost:7890');
  
  ws.onopen = () => {
    console.log('[Lokvis] Connected to MCP bridge');
    ws.send(JSON.stringify({
      type: 'register',
      capabilities: runtime.capabilities().map(c => c.name),
      version: RUNTIME_VERSION,
    }));
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'call_tool') {
      try {
        const result = await executeViaRuntime(runtime, msg.tool, msg.params);
        ws.send(JSON.stringify({ id: msg.id, type: 'result', result }));
      } catch (err) {
        ws.send(JSON.stringify({ id: msg.id, type: 'error', error: String(err) }));
      }
    }
  };

  // 心跳保活
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
  }, 30000);

  return ws;
}
```

#### 模式 2：Node.js 降级模式（无浏览器）

用户未打开浏览器，或浏览器 Tab 已关闭：

```
Claude Desktop
    │ stdio
    ▼
@lokvis/mcp-server (Node.js)
    │ 直接调用
    ▼
Node Engine Adapter (sharp + pdf-lib)
```

**能力降级矩阵**：

| 能力 | 浏览器模式 | Node 降级模式 |
|---|---|---|
| image.compress | Canvas + WebP | ✅ sharp |
| image.resize | Canvas | ✅ sharp |
| image.convert | Canvas | ✅ sharp |
| image.watermark | Canvas | ✅ sharp + 叠加 |
| image.crop | Canvas | ✅ sharp |
| pdf.merge | pdf-lib | ✅ pdf-lib（相同） |
| video.* | ffmpeg.wasm | ❌ 不支持 |
| audio.* | Web Audio | ❌ 不支持 |
| OPFS 大文件 | ✅ | ✅ fs（语义不同但可用） |
| 批量处理 | ✅ | ✅ |

#### 模式 3：Web SSE 模式（Phase 2.5+，实验性）

适用于 Web 端 AI 客户端集成。浏览器 Service Worker 作为 MCP server，通过 Cloudflare Tunnel 暴露公网 URL。**Phase 2 不实现，视 MCP Web 生态发展再定**。

### 3.5 ToolRouter 路由逻辑

```typescript
// packages/mcp-server/src/router.ts
export class ToolRouter {
  constructor(
    private browserBridge: BrowserBridge,
    private nodeEngine: NodeEngineAdapter,
  ) {}

  async execute(tool: string, params: unknown): Promise<unknown> {
    const capability = toolToCapability(tool); // lokvis_compress_image → image.compress

    // 1. 浏览器优先（完整能力）
    if (this.browserBridge.isConnected()) {
      try {
        return await this.browserBridge.callTool(tool, params);
      } catch (err) {
        console.error(`[lokvis] Browser call failed: ${err}, falling back to Node`);
      }
    }

    // 2. Node 降级
    if (this.nodeEngine.supports(capability)) {
      return await this.nodeEngine.execute(capability, params);
    }

    // 3. 都不可用
    throw new Error(
      `Tool ${tool} not available. ` +
      (this.browserBridge.isConnected()
        ? 'Browser runtime does not support this capability.'
        : 'Browser not connected (open lokvis.app) and Node.js engine does not support this capability.')
    );
  }
}
```

### 3.6 文件访问设计

**核心难点**：AI 客户端引用本地文件路径（如 `/Users/emily/photo.jpg`），但浏览器无法直接访问文件系统。

**混合方案**：

| 文件大小 | 传输方式 | 实现 |
|---|---|---|
| < 10MB | Node Bridge 读取 → base64 → WebSocket | 透明，AI 无感 |
| ≥ 10MB | File System Access API（浏览器直接读） | 提示用户在浏览器授权 |
| 批量（>10 文件） | 路径列表 → Node 逐个读取 | Bridge 批量传输 |

```typescript
// packages/mcp-server/src/adapters/browser-bridge.ts
async function prepareFileForBrowser(filePath: string): Promise<string> {
  const stat = await fs.stat(filePath);
  if (stat.size < 10 * 1024 * 1024) {
    const buffer = await fs.readFile(filePath);
    return buffer.toString('base64');
  }
  // 大文件：返回路径，浏览器端用 File System Access API 处理
  // AI 客户端会收到提示让用户在浏览器操作
  throw new McpToolError(
    'FILE_TOO_LARGE',
    `File ${filePath} (${stat.size} bytes) exceeds 10MB. Open lokvis.app and grant directory access.`
  );
}
```

### 3.7 安全模型

| 威胁 | 缓解措施 |
|---|---|
| 恶意 MCP client 窃取文件 | Tool 白名单；文件路径限制工作目录；拒绝 `..` 路径 |
| WebSocket 被本地其他进程连接 | origin 校验（仅 `lokvis.app`）+ 连接 token |
| 浏览器 Tab 被恶意网页控制 | WebSocket 仅接受来自 `lokvis.app` origin 的连接 |
| AI 调用危险操作 | 危险 tool 需用户在浏览器确认（如删除文件） |
| 降级模式 sharp RCE | sharp 是成熟库，输入参数 Zod 校验 |

### 3.8 包结构设计

```
packages/mcp-server/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts              # 公共入口：createLokvisMcpServer()
│   ├── server.ts             # MCP server 核心（基于 @modelcontextprotocol/sdk）
│   ├── tools/
│   │   ├── image.ts          # 图片处理 tools（compress/resize/convert/crop/watermark）
│   │   ├── pdf.ts            # PDF tools（merge/split/compress）— Phase 2.5+
│   │   ├── workflow.ts       # workflow 执行 tool
│   │   └── asset.ts          # asset 管理 tools（list/get/export）
│   ├── resources/
│   │   ├── capabilities.ts   # 暴露能力列表为 MCP resource
│   │   └── workflows.ts      # 暴露已保存 workflow 为 MCP resource
│   ├── prompts/
│   │   └── templates.ts      # 常见任务 prompt 模板
│   ├── adapters/
│   │   ├── node-stdio.ts     # Node.js stdio 传输适配
│   │   ├── browser-sse.ts    # 浏览器 SSE 传输适配（Phase 2.5+）
│   │   └── node-engine.ts    # Node.js 环境的 engine 适配（sharp 替代 canvas）
│   └── __tests__/
│       ├── tools.test.ts
│       └── server.test.ts
└── examples/
    ├── claude-desktop.md     # Claude Desktop 配置示例
    └── cursor.md             # Cursor 配置示例
```

### 3.9 核心 API 设计

#### 3.5.1 创建 MCP Server

```typescript
// packages/mcp-server/src/index.ts

import { createLokvis } from '@lokvis/sdk';
import { pluginImage } from '@lokvis/plugin-image';
import { createLokvisMcpServer, type LokvisMcpOptions } from './server.js';

export interface LokvisMcpOptions {
  /** 工作目录：资产读写根路径（Node 模式） */
  workdir?: string;
  /** 启用的能力域，默认 ['image'] */
  domains?: ('image' | 'pdf' | 'video' | 'audio' | 'ai')[];
  /** 是否启用 workflow 执行 tool */
  enableWorkflow?: boolean;
  /** 运行模式 */
  mode?: 'stdio' | 'sse';
  /** SSE 模式的端口（仅 mode='sse'） */
  port?: number;
}

export async function createLokvisMcpServer(options: LokvisMcpOptions = {}) {
  // 1. 创建 Lokvis Runtime
  const runtime = await createLokvis({
    plugins: [pluginImage],  // 根据 domains 动态加载
    assetStore: options.workdir 
      ? createNodeAssetStore(options.workdir) 
      : createMemoryAssetStore(),
  });

  // 2. 创建 MCP server
  const server = new McpServer({
    name: 'lokvis',
    version: '0.1.0',
    description: 'Lokvis local-first file processing engine',
  });

  // 3. 注册 tools / resources / prompts
  registerImageTools(server, runtime);
  registerWorkflowTools(server, runtime);
  registerCapabilityResources(server, runtime);
  registerPromptTemplates(server);

  // 4. 启动传输
  const transport = options.mode === 'sse'
    ? new SSETransport(options.port ?? 3001)
    : new StdioTransport();
  
  await server.connect(transport);
  return { server, runtime, transport };
}
```

#### 3.5.2 Tool 定义示例

```typescript
// packages/mcp-server/src/tools/image.ts

import { McpServer } from '@modelcontextprotocol/sdk';
import type { LokvisRuntime } from '@lokvis/sdk';

export function registerImageTools(server: McpServer, runtime: LokvisRuntime) {
  
  // ─── compress_image ───────────────────────────
  server.tool(
    'lokvis_compress_image',
    'Compress an image locally without uploading. Supports target size, quality, and format conversion.',
    {
      input_path: z.string().describe('Absolute path or asset ID of the input image'),
      output_path: z.string().optional().describe('Output path. If omitted, returns base64.'),
      target_size_kb: z.number().optional().describe('Target file size in KB (e.g., 100 for <100KB)'),
      quality: z.number().min(1).max(100).optional().describe('Quality 1-100 (JPEG/WebP)'),
      output_format: z.enum(['jpeg', 'png', 'webp', 'avif']).optional().describe('Output format'),
    },
    async (params) => {
      // 1. 导入 asset
      const asset = await runtime.importAsset(params.input_path);
      
      // 2. 执行 compress
      const result = await runtime.run({
        version: '1.0',
        nodes: [
          { id: 'n1', capability: 'image.compress', inputs: { input: asset.id }, 
            params: { 
              targetSizeKb: params.target_size_kb,
              quality: params.quality,
              outputFormat: params.output_format,
            } 
          }
        ],
        edges: [],
      });
      
      // 3. 输出
      const output = await runtime.getAsset(result.outputs[0]);
      if (params.output_path) {
        await writeFile(params.output_path, output.blob);
        return { content: [{ type: 'text', text: `Compressed image saved to ${params.output_path}` }] };
      }
      return { 
        content: [
          { type: 'text', text: `Compressed image. Original: ${asset.metadata.size}, Output: ${output.metadata.size}` },
          { type: 'image', data: base64(output.blob), mimeType: output.metadata.format },
        ] 
      };
    }
  );

  // ─── resize_image ─────────────────────────────
  server.tool(
    'lokvis_resize_image',
    'Resize an image locally. Supports preset sizes (YouTube/TikTok/Instagram) and custom dimensions.',
    {
      input_path: z.string(),
      output_path: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      preset: z.enum(['youtube-thumbnail', 'tiktok-cover', 'instagram-square', 'instagram-story', 'twitter-card', 'linkedin-banner']).optional(),
      maintain_aspect: z.boolean().default(true),
    },
    // ... 实现类似
  );

  // ─── batch_process ────────────────────────────
  server.tool(
    'lokvis_batch_process',
    'Batch process multiple images with the same operation. Up to 100 files. Local execution, no upload.',
    {
      input_paths: z.array(z.string()).max(100),
      operation: z.enum(['compress', 'resize', 'convert', 'watermark']),
      params: z.record(z.any()),
      output_dir: z.string(),
    },
    async (params) => {
      const results = [];
      for (const path of params.input_paths) {
        const asset = await runtime.importAsset(path);
        const result = await runtime.run({
          version: '1.0',
          nodes: [{ id: 'n1', capability: `image.${params.operation}`, 
                    inputs: { input: asset.id }, params: params.params }],
          edges: [],
        });
        const output = await runtime.getAsset(result.outputs[0]);
        const outPath = join(params.output_dir, basename(path));
        await writeFile(outPath, output.blob);
        results.push({ input: path, output: outPath, size: output.metadata.size });
      }
      return { content: [{ type: 'text', text: `Processed ${results.length} files:\n${JSON.stringify(results, null, 2)}` }] };
    }
  );
}
```

#### 3.5.3 Resource 定义

```typescript
// packages/mcp-server/src/resources/capabilities.ts

export function registerCapabilityResources(server: McpServer, runtime: LokvisRuntime) {
  
  // 暴露能力列表为 resource
  server.resource(
    'lokvis://capabilities',
    'List all available Lokvis capabilities',
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(runtime.capabilities(), null, 2),
      }],
    })
  );

  // 暴露已保存的 workflow 列表
  server.resource(
    'lokvis://workflows',
    'List saved workflows',
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(await runtime.listWorkflows?.() ?? [], null, 2),
      }],
    })
  );
}
```

#### 3.5.4 Prompt 模板

```typescript
// packages/mcp-server/src/prompts/templates.ts

export function registerPromptTemplates(server: McpServer) {
  
  server.prompt(
    'optimize-for-web',
    'Generate a workflow to optimize images for web (compress + resize + convert to WebP)',
    {
      input_path: z.string().describe('Path to the image'),
      max_width: z.number().default(1920),
      target_size_kb: z.number().default(200),
    },
    async (params) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please optimize the image at ${params.input_path} for web use:
1. Resize to max width ${params.max_width}px (maintain aspect ratio)
2. Convert to WebP format
3. Compress to under ${params.target_size_kb}KB

Use lokvis tools to process the image locally.`,
        },
      }],
    })
  );
}
```

### 3.10 依赖设计

```json
// packages/mcp-server/package.json
{
  "name": "@lokvis/mcp-server",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@lokvis/sdk": "workspace:*",
    "@lokvis/plugin-image": "workspace:*",
    "@lokvis/schema": "workspace:*",
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "sharp": "^0.33.0"  // Node.js 模式下可选，用于替代 canvas
  },
  "bin": {
    "lokvis-mcp": "./dist/cli.js"
  }
}
```

### 3.11 客户端配置示例

#### Claude Desktop 配置

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server"],
      "env": {
        "LOKVIS_WORKDIR": "/Users/emily/Documents"
      }
    }
  }
}
```

#### Cursor 配置

```json
// ~/.cursor/mcp.json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server@latest"]
    }
  }
}
```

### 3.12 实现优先级（混合架构 E）

| 阶段 | 任务 | 时机 |
|---|---|---|
| Phase 1 W11-W12 | MCP server 接口设计 + 传输架构评审（6h） | 2026-09 |
| Phase 2 W1-W2 | `@lokvis/mcp-server` 包骨架 + stdio 传输 + Node 降级引擎（sharp） | 2027-01 |
| Phase 2 W3-W4 | `@lokvis/mcp-browser-client` 浏览器 WebSocket 连接 + ToolRouter | 2027-01 |
| Phase 2 W5-W6 | image tools 实现（compress/resize/convert）+ 浏览器优先路由 | 2027-02 |
| Phase 2 W7-W8 | batch_process + workflow execution + 文件访问混合方案 | 2027-02 |
| Phase 2 W9-W10 | resources + prompts 注册 + Claude Desktop 集成测试 | 2027-03 |
| Phase 2 W11-W12 | npm 发布 + MCP registry 提交 + 文档 + 营销 | 2027-03 |

> **工时修正**：原 76h P0 调整为 **96h P0 + 12h P1**（增加 20h 用于 BrowserBridge + mcp-browser-client + ToolRouter）。

---

## 四、Plugin SDK 定位调整

### 4.1 原定位 vs 新定位

| 维度 | 原定位 | 新定位 |
|---|---|---|
| 战略角色 | 生态核心，第三方扩展 Lokvis | **兼容层**，仅用于浏览器内嵌入场景 |
| 正式发布 | Phase 2 v1 | **Phase 3 或取消**（除非有明确用户需求） |
| 优先级 | P0 | **P3**（Alpha 预览保留，仅教学性质） |
| 替代方案 | — | MCP server 优先 |

### 4.2 保留 Plugin SDK 的场景

尽管 Plugin SDK 降级，但以下场景仍需保留：

1. **浏览器内嵌入**：用户用 `@lokvis/sdk` 嵌入到自己网站，需要自定义能力 → Plugin SDK 仍必要
2. **教学与示例**：让开发者理解 Lokvis 能力模型 → Alpha 预览足够
3. **未来兼容**：若 MCP 生态变化，Plugin SDK 可作为 fallback

### 4.3 对 `packages/plugin-sdk` 的修改

**不删除，但不主动投入**：
- `definePlugin` / `createCapabilityImpl` / `definePanel` 维持现状
- `PluginContext` 类型维持，但增加注释说明"推荐使用 MCP server"
- 不发布 v1.0，仅维持 0.1.0-alpha

### 4.4 对 PROJECT_PLAN W18 任务的调整

原 W18 任务（全部 P1）调整：

| 任务 ID | 原任务 | 新状态 | 调整 |
|---|---|---|---|
| 18.1 | `@lokvis/plugin-sdk` 发布到 npm（0.1.0-alpha） | ✅ 维持 | 作为教学预览 |
| 18.2 | Plugin SDK 文档 | ✅ 维持，**增加 MCP server 对比章节** | 说明两者关系 |
| 18.3 | 示例插件 `plugin-grayscale` | ✅ 维持 | 教学用 |
| 18.4 | 示例插件 `plugin-batch-watermark` | ⏭️ 延后 | 实用插件改为 MCP tool |
| 18.5 | Plugin 脚手架 `pnpm create @lokvis/plugin` | ⏭️ 延后 | 优先做 `npx @lokvis/mcp-server` |
| 18.6 | Plugin 权限沙箱 | ✅ 维持 P0 | 安全必需 |

---

## 五、engine-ai 定位调整

### 5.1 现状

[`packages/engine-ai`](../packages/engine-ai/src/index.ts) 当前为 stub，包含：
- `transformersEngine`：本地 AI（OCR/caption/background-remove），所有方法抛 Not Implemented
- `cloudProxyEngine`：云端 AI（generate-workflow/optimize-workflow），`isSupported` 恒返回 false

### 5.2 新定位

**原定位**：AI 作为 Plugin，替代手动 workflow 编排。

**新定位**：**AI 辅助 workflow 设计**，不替代确定性执行。

| 能力 | 定位 | 实现时机 |
|---|---|---|
| `ai.generate-workflow` | AI 辅助生成 workflow JSON（用户描述意图 → AI 输出 workflow） | Phase 2 |
| `ai.optimize-workflow` | AI 分析现有 workflow 并建议优化 | Phase 2 |
| `ai.ocr` | 本地 OCR（隐私差异化） | Phase 2 |
| `ai.caption` | 本地图片描述（无障碍/SEO） | Phase 2.5 |
| `ai.background-remove` | 本地背景移除 | Phase 2.5 |

### 5.3 设计原则

1. **AI 只设计，不执行**：AI 生成的 workflow 仍由确定性 Runtime 执行，避免随机性
2. **本地 AI 优先**：`transformersEngine` 优先实现，作为隐私差异化卖点
3. **云端 AI 可选**：`cloudProxyEngine` 接 lokvis-cloud 的 `/ai/*` 端点，但 Phase 2 才启用

### 5.4 对 engine-ai 的修改

**不修改代码**，仅修改文档与注释：

```typescript
// packages/engine-ai/src/index.ts 文件头注释更新
/**
 * @lokvis/engine-ai
 * 
 * AI 能力适配层。
 * 
 * 定位：AI 辅助 workflow 设计，不替代确定性执行。
 * - transformersEngine：本地 AI（OCR/caption/background-remove），隐私优先
 * - cloudProxyEngine：云端 AI（generate-workflow/optimize-workflow），接 lokvis-cloud
 * 
 * 设计原则：
 * 1. AI 只设计，不执行：生成的 workflow 由 Runtime 确定性执行
 * 2. 本地 AI 优先：transformers.js 在浏览器内运行，文件不上传
 * 3. 云端 AI 可选：cloudProxyEngine 需用户授权并消耗 AI Credits
 * 
 * Phase 1：stub 占位
 * Phase 2：实现 cloudProxyEngine 接口 + transformersEngine OCR
 */
```

---

## 六、SDK 扩展设计

### 6.1 新增 API：`runtime.toMcpManifest()`

为了让用户了解 Runtime 当前可被 MCP 暴露的能力，新增 API：

```typescript
// packages/sdk/src/index.ts 新增导出

export interface McpToolManifest {
  name: string;
  description: string;
  inputSchema: object;  // JSON Schema
  capabilities: string[];  // 依赖的 Lokvis capability 名
}

export interface McpResourceManifest {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface McpManifest {
  serverName: string;
  version: string;
  tools: McpToolManifest[];
  resources: McpResourceManifest[];
}

// Runtime 实例新增方法
export interface LokvisRuntime {
  // ... 现有 API
  
  /**
   * 生成 MCP server manifest（不启动 server，仅描述可用能力）
   * 用于：
   * 1. @lokvis/mcp-server 注册 tools 前的能力探测
   * 2. Dashboard 展示"可被 AI 调用的能力"
   * 3. 文档站自动生成 MCP tools 列表
   */
  toMcpManifest(): McpManifest;
}
```

### 6.2 实现细节

```typescript
// packages/runtime/src/runtime.ts 新增方法

toMcpManifest(): McpManifest {
  const tools: McpToolManifest[] = [];
  const capabilities = this.capabilityRegistry.list();
  
  for (const cap of capabilities) {
    // 把 Lokvis capability 转换为 MCP tool manifest
    tools.push({
      name: `lokvis_${cap.name.replace(/\./g, '_')}`,
      description: cap.description ?? `Execute ${cap.name}`,
      inputSchema: this.capabilityToInputSchema(cap),
      capabilities: [cap.name],
    });
  }
  
  return {
    serverName: 'lokvis',
    version: RUNTIME_VERSION,
    tools,
    resources: [
      { uri: 'lokvis://capabilities', name: 'Capabilities', 
        description: 'List all available capabilities', mimeType: 'application/json' },
      { uri: 'lokvis://workflows', name: 'Workflows', 
        description: 'List saved workflows', mimeType: 'application/json' },
    ],
  };
}

private capabilityToInputSchema(cap: Capability): object {
  // 把 Zod schema 转换为 JSON Schema
  return zodToJsonSchema(cap.paramsSchema);
}
```

### 6.3 依赖新增

```json
// packages/runtime/package.json 新增依赖
{
  "dependencies": {
    "zod-to-json-schema": "^3.23.0"
  }
}
```

---

## 七、Capability 与 Schema 扩展

### 7.1 Capability MCP 元数据（可选）

在 [packages/capability](../packages/capability/src/index.ts) 的 Capability 类型中增加可选字段：

```typescript
// packages/schema/src/capability.ts 扩展

export interface Capability {
  // ... 现有字段
  name: string;
  description?: string;
  paramsSchema: ZodSchema;
  inputType: AssetType;
  outputType: AssetType;
  
  /**
   * MCP 暴露配置（可选）
   * - 'public': 默认暴露给 MCP server
   * - 'private': 不暴露（如内部能力）
   * - 'batch-only': 仅在 batch 模式暴露
   */
  mcpExposure?: 'public' | 'private' | 'batch-only';
  
  /**
   * MCP tool 名称覆盖（可选）
   * 默认为 `lokvis_${name.replace(/\./g, '_')}`
   */
  mcpToolName?: string;
}
```

### 7.2 Workflow 导出为 AI 指令

为了让 AI Agent 能理解并执行 Lokvis workflow，新增导出格式：

```typescript
// packages/schema/src/workflow.ts 新增

export interface WorkflowAiInstruction {
  /** 人类可读的指令描述 */
  instruction: string;
  /** 涉及的 Lokvis capability 名 */
  capabilities: string[];
  /** 输入参数 schema */
  inputSchema: object;
  /** 示例调用 */
  example: {
    input: Record<string, unknown>;
    expectedOutput: string;
  };
}

export function workflowToAiInstruction(workflow: Workflow): WorkflowAiInstruction {
  // 把 Workflow JSON 转换为 AI 可理解的指令
  const steps = workflow.nodes.map(n => 
    `${n.capability} with params ${JSON.stringify(n.params ?? {})}`
  );
  
  return {
    instruction: `Execute ${workflow.nodes.length}-step workflow: ${steps.join(' → ')}`,
    capabilities: workflow.nodes.map(n => n.capability),
    inputSchema: workflowInputsToJsonSchema(workflow),
    example: {
      input: { input_path: '/path/to/file' },
      expectedOutput: 'Processed file saved to output path',
    },
  };
}
```

---

## 八、Web 与文档调整

### 8.1 apps/web 营销页面调整

> **⚠️ 已废弃（ADR-012）**：apps/web 已于 2026-07-02 整体迁出至 lokvis-cloud 仓库（ADR-012 + M0.5.7.1）。本节中的 `apps/web` 路径均指迁出前的历史位置，实际落地在 `lokvis-cloud/apps/web`。本节保留作为历史决策记录。

#### 8.1.1 首页 Hero 文案调整

**原文案**（`apps/web/src/pages/index.astro`）：
> "Local-first Browser Workspace"

**新文案建议**：
> **"AI 时代的本地处理引擎"**
> 
> 让 Claude / ChatGPT / Cursor 安全、免费、批量地处理你的文件。
> 文件不上传，隐私不泄露，处理不限量。

#### 8.1.2 新增"AI 做不到的 6 件事"Section

在首页 Features 区后新增对比 section：

```astro
<!-- apps/web/src/components/AiComparison.astro -->
<section class="ai-comparison">
  <h2>AI 做不到的 6 件事，Lokvis 能</h2>
  <div class="comparison-grid">
    <div class="card">
      <h3>📦 批量处理 100+ 文件</h3>
      <p>AI Agent 处理 10+ 文件容易超时。Lokvis 并发 4，稳定完成。</p>
    </div>
    <div class="card">
      <h3>🎥 大文件（>50MB 视频）</h3>
      <p>AI 有文件大小限制。Lokvis 本地 WASM，无限制。</p>
    </div>
    <div class="card">
      <h3>🔒 隐私敏感场景</h3>
      <p>AI 需要上传文件。Lokvis 本地处理，文件不出浏览器。</p>
    </div>
    <div class="card">
      <h3>🔁 确定性 workflow</h3>
      <p>AI 有随机性。Lokvis workflow 每次结果一致，合规友好。</p>
    </div>
    <div class="card">
      <h3>📡 离线场景</h3>
      <p>AI 不可用离线。Lokvis PWA 完整离线工作。</p>
    </div>
    <div class="card">
      <h3>⚙️ 专业参数控制</h3>
      <p>AI 不支持 DPI/EXIF/色彩空间。Lokvis 精细控制每个参数。</p>
    </div>
  </div>
</section>
```

#### 8.1.3 工具页 SEO 关键词调整

在 [ToolLayout.astro](../apps/web/src/layouts/ToolLayout.astro) 的 "Why use Lokvis?" 卡片中增加 AI 对比文案：

| 原卡片 | 新增卡片 |
|---|---|
| Privacy: 文件不上传 | **vs AI: ChatGPT 需要上传，Lokvis 本地处理** |
| Speed: 零等待 | **vs AI: 无需等待 AI 响应** |
| Free: 免费 | **vs AI: 不消耗 AI tokens** |
| Offline: 离线可用 | **vs AI: AI 离线不可用** |

#### 8.1.4 新增"MCP Integration"落地页

```astro
<!-- apps/web/src/pages/mcp.astro -->
---
const title = 'Lokvis MCP Server - 让 AI 处理你的本地文件';
---
<Layout title={title}>
  <section>
    <h1>Lokvis MCP Server</h1>
    <p>把 Lokvis 的本地处理能力暴露给 Claude / ChatGPT / Cursor。</p>
    
    <h2>快速开始</h2>
    <pre><code>npx @lokvis/mcp-server</code></pre>
    
    <h2>Claude Desktop 配置</h2>
    <pre><code>{JSON.stringify(claudeConfig, null, 2)}</code></pre>
    
    <h2>可用 Tools</h2>
    <ul>
      <li>lokvis_compress_image - 本地压缩图片</li>
      <li>lokvis_resize_image - 本地调整尺寸</li>
      <li>lokvis_batch_process - 批量处理（最多 100 文件）</li>
      <li>lokvis_run_workflow - 执行已保存的 workflow</li>
    </ul>
  </section>
</Layout>
```

### 8.2 apps/docs 文档站调整

#### 8.2.1 新增 "MCP Integration" 页面

```markdown
<!-- apps/docs/src/content/docs/mcp.mdx -->

---
title: MCP Integration
description: 把 Lokvis 能力暴露给 AI 客户端（Claude/ChatGPT/Cursor）
---

import { Mermaid } from '@astrojs/starlight/components';

# MCP Integration

Lokvis 提供 MCP（Model Context Protocol）server，让 AI 客户端直接调用 Lokvis 的本地处理能力。

## 架构

<Mermaid chart={\`
graph LR
  A[AI Client] -->|MCP Protocol| B[@lokvis/mcp-server]
  B -->|Internal API| C[@lokvis/sdk Runtime]
  C --> D[engine-image / engine-pdf]
  D --> E[Local WASM/Canvas Processing]
\`} />

## 快速开始

### 1. 安装

\`\`\`bash
npm install @lokvis/mcp-server
\`\`\`

### 2. Claude Desktop 配置

编辑 `claude_desktop_config.json`：

\`\`\`json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/mcp-server"],
      "env": { "LOKVIS_WORKDIR": "/Users/you/Documents" }
    }
  }
}
\`\`\`

### 3. 可用 Tools

| Tool | 描述 | 示例 |
|---|---|---|
| `lokvis_compress_image` | 本地压缩图片 | "Compress image.jpg to <100KB" |
| `lokvis_resize_image` | 本地调整尺寸 | "Resize to 1920x1080" |
| `lokvis_batch_process` | 批量处理 | "Compress all images in /photos" |
| `lokvis_run_workflow` | 执行 workflow | "Run my 'web-optimize' workflow" |

## 运行模式

### stdio 模式（推荐）

适用于 Claude Desktop / Cursor 等桌面客户端。

### SSE 模式（实验性）

适用于 Web 端集成。
```

#### 8.2.2 更新 plugins.md

在 [plugins.md](../apps/docs/src/content/docs/plugins.md) 增加"MCP Server vs Plugin SDK"章节：

```markdown
## Plugin SDK vs MCP Server

Lokvis 提供两种扩展方式：

| 维度 | Plugin SDK | MCP Server |
|---|---|---|
| 适用场景 | 浏览器内嵌入 SDK | AI 客户端集成（Claude/ChatGPT） |
| 协议 | Lokvis 自定义 | MCP 标准 |
| 生态 | 仅 Lokvis 用户 | 所有 MCP 兼容客户端 |
| 优先级 | Alpha 预览（教学） | **推荐方式** |
| Phase | Phase 1 Alpha | Phase 2 正式 |

**推荐**：如果你想让 AI 调用你的能力，使用 MCP Server。
如果你在浏览器内嵌入 Lokvis，使用 Plugin SDK。
```

#### 8.2.3 更新 roadmap.md

在 [roadmap.md](../apps/docs/src/content/docs/roadmap.md) 反映战略调整：

```markdown
## Phase 2（2027.01-06）

### 原计划
- PDF + Video 工具
- Plugin SDK v1
- Marketplace Alpha

### 调整后
- PDF + Video 工具（维持）
- **MCP Server v1（新增，P0）**
- Plugin SDK v1 → **降级为 Alpha，优先 MCP**
- Marketplace Alpha → **改为免费社区分享**
```

---

## 九、examples/ 目录新增

### 9.1 新增 `examples/mcp-claude-desktop`

```
examples/mcp-claude-desktop/
├── package.json
├── README.md
├── claude_config.json     # Claude Desktop 配置示例
└── demo/
    ├── sample-image.jpg
    └── test-prompts.md    # 测试用 prompt 列表
```

**README.md 内容**：
- 安装步骤
- Claude Desktop 配置
- 5 个测试 prompt：
  1. "Compress this image to <100KB"
  2. "Resize all images in /photos to 1920px width"
  3. "Convert image.png to WebP"
  4. "Add watermark 'Confidential' to bottom-right"
  5. "Run my web-optimize workflow on this image"

### 9.2 新增 `examples/mcp-custom-tool`

演示如何用 `@lokvis/mcp-server` 包自定义 tool：

```
examples/mcp-custom-tool/
├── package.json
├── README.md
└── src/
    └── custom-server.ts   # 自定义 MCP server 示例
```

---

## 十、PROJECT_PLAN 任务调整

### 10.1 优先级变更表

| 任务 ID | 原任务 | 原优先级 | 新优先级 | 调整理由 |
|---|---|---|---|---|
| 3.2 | Engine Image streaming 改造：大图按行分片 | P0 | **P0（维持，但提升重要性）** | AI 短板强化 |
| 3.3 | 内存阈值监测：超 512MB 中间结果落 OPFS | P0 | **P0（维持）** | 大文件处理是 AI 短板 |
| 8.8 | 隐私声明"文件未上传"指示器 | P0 | **P0（维持，强化文案对比 AI）** | 差异化核心 |
| 18.4 | 示例插件 `plugin-batch-watermark` | P1 | **⏭️ 延后到 Phase 2** | 改为 MCP tool 实现 |
| 18.5 | Plugin 脚手架 `pnpm create @lokvis/plugin` | P1 | **⏭️ 延后到 Phase 2** | 优先 MCP server |

### 10.2 新增任务

| 任务 ID | 任务 | 优先级 | 估时 | 周次 | 产出 |
|---|---|---|---|---|---|
| **11.6** | MCP server 接口设计草案（tools/resources/prompts 清单） | P1 | 4h | W11 | `docs/mcp-design-draft.md` |
| **12.8** | MCP server 接口设计评审 + ADR-011 状态确认 | P1 | 2h | W12 | ADR 更新 |
| **17.10** | 首页新增"AI 做不到的 6 件事"对比 section | P0 | 4h | W17 | `AiComparison.astro` |
| **17.11** | ToolLayout "Why use Lokvis?" 增加 vs AI 文案 | P0 | 2h | W17 | ToolLayout 更新 |
| **19.10** | 新增 `/mcp` 落地页（MCP server 介绍 + 配置指南） | P1 | 4h | W19 | `apps/web/src/pages/mcp.astro` |

### 10.3 文档任务调整

| 任务 ID | 原任务 | 调整后 |
|---|---|---|
| 4.8 | docs Getting Started / SDK / Architecture 三页 | **新增 MCP Integration 第四页** |
| 18.2 | Plugin SDK 文档 | **增加"MCP Server vs Plugin SDK"对比章节** |
| 19.x | Roadmap 文档 | **反映 Phase 2 MCP 优先 + Plugin SDK 降级** |

### 10.4 Phase 2 新增任务预告

以下任务在 Phase 2 启动时正式纳入计划：

| 任务 | 优先级 | 估时 | 产出 |
|---|---|---|---|
| `@lokvis/mcp-server` 包骨架 + stdio 传输 | P0 | 16h | `packages/mcp-server/` |
| image tools 实现（compress/resize/convert） | P0 | 16h | `tools/image.ts` |
| batch_process + workflow execution tools | P0 | 12h | `tools/workflow.ts` |
| resources + prompts 注册 | P1 | 8h | `resources/` + `prompts/` |
| Claude Desktop 集成测试 | P0 | 8h | 测试报告 |
| npm 发布 + MCP registry 提交 | P0 | 4h | `@lokvis/mcp-server@0.1.0` |
| `runtime.toMcpManifest()` API 实现 | P0 | 8h | `sdk` + `runtime` 扩展 |
| `examples/mcp-claude-desktop` 示例 | P1 | 4h | examples 目录 |

**Phase 2 MCP 相关总工时**：约 76h P0 + 12h P1

---

## 十一、依赖与风险

### 11.1 跨仓库依赖

```
lokvis-open（本仓库）
├── packages/mcp-server ──依赖──→ @lokvis/sdk（本仓库）
│                             └──→ @modelcontextprotocol/sdk（npm）
└── packages/sdk ──新增方法──→ toMcpManifest()

lokvis-cloud（兄弟仓库）
└── apps/api ──可选──→ @lokvis/mcp-server（用于 cloud 端 SSE 模式）
```

### 11.2 关键风险

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| MCP SDK API 变更（Phase 2 时） | 中 | 🟡 中 | 设计抽象层，隔离 SDK 变化 |
| Node.js 环境下 engine-image 不可用（无 Canvas） | 高 | 🟡 中 | Phase 2 实现 `node-engine.ts` 适配（sharp） |
| Claude Desktop 不接受 Lokvis MCP server | 低 | 🔴 高 | 同时支持 Cursor / Windsurf 等多客户端 |
| MCP Web 生态不成熟（SSE 模式） | 中 | 🟢 低 | Phase 2 仅做 stdio，SSE 延后 |
| MCP server 性能不达预期（大文件传输） | 中 | 🟡 中 | 用文件路径而非 base64 传输；流式处理 |

### 11.3 技术约束

1. **Node.js vs 浏览器能力差异**：
   - `engine-image` 当前依赖 Canvas API，Node.js 环境不可用
   - Phase 2 需实现 `adapters/node-engine.ts`，用 `sharp` 替代 Canvas
   - 或限制 MCP server stdio 模式仅支持"路径输入/路径输出"，不返回 base64

2. **MCP SDK 版本**：
   - `@modelcontextprotocol/sdk` 当前 1.0.0
   - API 仍在演进，Phase 2 实现时需确认最新 API

3. **包大小限制**：
   - `@lokvis/mcp-server` 通过 `npx` 执行，需控制依赖大小
   - `sharp` 安装体积大（~50MB），考虑用 `canvas` 或纯 JS 实现

---

## 十二、实施时间表

### Phase 1（2026.07-12）调整

| 周次 | 调整任务 | 工时 | 优先级 |
|---|---|---|---|
| W11 | MCP server 接口设计草案 | 4h | P1 |
| W12 | MCP server 接口设计评审 | 2h | P1 |
| W17 | 首页"AI 做不到的 6 件事"section | 4h | P0 |
| W17 | ToolLayout vs AI 文案 | 2h | P0 |
| W19 | `/mcp` 落地页 | 4h | P1 |

**Phase 1 调整总工时**：16h（其中 6h P0 + 10h P1）

> 这 16h 从 PROJECT_PLAN 现有 Buffer 中扣除，不影响 P0 主线。

### Phase 2（2027.01-06）新增

| 周次 | 任务 | 工时 | 优先级 |
|---|---|---|---|
| W1-2 | `@lokvis/mcp-server` 包骨架 | 16h | P0 |
| W3-4 | image tools 实现 | 16h | P0 |
| W5-6 | batch + workflow tools | 12h | P0 |
| W7-8 | resources + prompts | 8h | P1 |
| W9-10 | Claude Desktop 集成测试 + npm 发布 | 12h | P0 |
| W11-12 | `runtime.toMcpManifest()` + examples | 12h | P0+P1 |

**Phase 2 MCP 总工时**：76h P0 + 12h P1

---

## 十三、决策记录

### ADR-O1：lokvis-open 新增 `@lokvis/mcp-server` 包

- **状态**：Proposed
- **日期**：2026-07-01
- **背景**：cloud 仓库 06 文档建议 Lokvis 转型为 MCP server，但 MCP server 的能力提供方应在 open 侧（能力来源）而非 cloud 侧（商业化层）
- **决策**：在 lokvis-open 新增 `packages/mcp-server`，作为 MCP 协议的适配层
- **理由**：
  1. MCP server 依赖 `@lokvis/sdk` 和 `@lokvis/plugin-*`，这些都在 open 侧
  2. MCP server 是开源能力（让 AI 调用本地处理），符合 MIT 许可
  3. cloud 侧可选消费 `@lokvis/mcp-server` 用于 SSE 模式
- **后果**：
  - open 侧新增一个包，维护成本增加
  - 需处理 Node.js 环境下的 engine 适配问题
  - `@modelcontextprotocol/sdk` 成为外部依赖

### ADR-O2：Plugin SDK 降级为兼容层

- **状态**：Proposed
- **日期**：2026-07-01
- **背景**：MCP 已成事实标准，自建 Plugin SDK 生态规模无法与 AI 平台竞争
- **决策**：Plugin SDK 不发布 v1.0，仅维持 0.1.0-alpha 作为教学与浏览器内嵌入用途
- **理由**：
  1. 开发者更愿意做 MCP server（触达所有 AI 平台）
  2. Plugin SDK 的浏览器内嵌入场景需求有限
  3. 维护两套扩展机制成本高
- **后果**：
  - PROJECT_PLAN W18 部分任务延后
  - `packages/plugin-sdk` 不主动投入，但不删除
  - 文档需明确 Plugin SDK 与 MCP Server 的关系

### ADR-O3：engine-ai 定位为"AI 辅助 workflow 设计"

- **状态**：Proposed
- **日期**：2026-07-01
- **背景**：原定位"AI 替代 workflow 编排"与 AI Agent 重叠，且 Lokvis 无法在 AI 能力上竞争
- **决策**：engine-ai 的 `generate-workflow` / `optimize-workflow` 定位为"AI 辅助设计"，执行仍由确定性 Runtime
- **理由**：
  1. AI 设计 + 确定性执行 = 混合架构，兼顾灵活性与可靠性
  2. 本地 AI（transformers.js）作为隐私差异化卖点
  3. 避免与 AI 平台直接竞争
- **后果**：
  - engine-ai 代码不修改，仅文档与注释更新
  - Phase 2 实现 cloudProxyEngine 接口
  - 营销突出"AI 辅助设计 + 确定性执行"

---

## 文档导航

- [← PROJECT_PLAN.md](./PROJECT_PLAN.md)
- [→ cloud 仓库 06-AI生态冲击与应对策略.md](../../lokvis-cloud/docs/06-AI生态冲击与应对策略.md)
- [→ apps/docs MCP Integration（待 Phase 2 创建）](../apps/docs/src/content/docs/)

---

*本文档基于 2026-07-01 仓库实际结构核查编制。所有调整需在 PROJECT_PLAN.md 中同步更新任务状态。Phase 2 启动时需细化 MCP server 实现任务到 2h 粒度。*

---

## 附录 A：MCP 传输架构方案对比

> 本附录详细对比五种将浏览器本地化能力暴露为 MCP server 的架构方案，供设计评审参考。

### A.1 核心矛盾

| MCP 协议要求 | 浏览器沙箱限制 |
|---|---|
| Server 能被 AI 客户端发现并连接 | 不能监听 TCP 端口 |
| 支持 stdio 或 HTTP/SSE 传输 | 不能访问 stdio |
| 长连接稳定 | 不能 spawn 子进程 |
| 文件路径访问 | 不能访问任意文件系统 |
| | Service Worker 生命周期短 |

**结论**：浏览器内的 Lokvis Runtime **无法直接**作为 MCP server，必须引入桥接层。

### A.2 架构 A：Node Bridge + 浏览器 Runtime

```
┌─────────────┐     stdio      ┌──────────────┐   WebSocket   ┌──────────────────┐
│ Claude Desk │ ─────────────→ │ @lokvis/     │ ────────────→ │ 浏览器 Tab        │
│ / Cursor    │                │ mcp-bridge   │ ←──────────── │ lokvis.app       │
└─────────────┘                │ (Node.js)    │   result     │ Lokvis Runtime   │
                               └──────────────┘               │ (WASM/Canvas/OPFS)│
                                                              └──────────────────┘
```

**关键设计**：浏览器作为 WebSocket **client** 主动连接 Node.js Bridge（Bridge 是 WebSocket server）。

| 维度 | 评估 |
|---|---|
| 能力完整度 | ✅ 完整（WASM/Canvas/OPFS/WebCodecs） |
| 部署复杂度 | 🟡 需安装 npm 包 + 保持浏览器 Tab 打开 |
| 用户体验 | ✅ 文件真正本地处理，可视化 |
| 实现难度 | 🟡 Bridge ~200 行，浏览器端连接 ~100 行 |
| 稳定性 | 🟡 依赖浏览器 Tab 不关闭 |

### A.3 架构 B：纯 Node.js MCP Server

```
┌─────────────┐     stdio      ┌──────────────────────────────┐
│ Claude Desk │ ─────────────→ │ @lokvis/mcp-server (Node.js) │
└─────────────┘                │  - sharp (替代 Canvas)        │
                               │  - fs (替代 OPFS)             │
                               └──────────────────────────────┘
```

| 维度 | 评估 |
|---|---|
| 能力完整度 | 🟡 降级（无 video/audio/OPFS） |
| 部署复杂度 | ✅ 单一进程，无浏览器依赖 |
| 用户体验 | 🟡 失去"浏览器本地化"叙事 |
| 实现难度 | 🟡 需重写 engine 适配（sharp ≠ Canvas API） |
| 稳定性 | ✅ 最稳定（无浏览器依赖） |
| 包大小 | ❌ sharp ~50MB native binary |

### A.4 架构 C：浏览器扩展 + Native Messaging

```
┌─────────────┐     stdio      ┌──────────────┐  native   ┌──────────────┐
│ Claude Desk │ ─────────────→ │ Lokvis       │  message  │ Browser      │
│             │                │ Native Host  │ ←───────→ │ Extension    │
└─────────────┘                │ (Node.js)    │           │              │
                               └──────────────┘           └──────┬───────┘
                                                                  │ postMessage
                                                                  ▼
                                                           ┌──────────────┐
                                                           │ Lokvis Tab   │
                                                           │ (Runtime)    │
                                                           └──────────────┘
```

| 维度 | 评估 |
|---|---|
| 能力完整度 | ✅ 完整（通过浏览器 Tab） |
| 部署复杂度 | ❌ 需安装扩展 + Native Messaging Host 配置复杂 |
| 用户体验 | 🟡 安装门槛高 |
| 实现难度 | ❌ Native Messaging manifest + 注册表/ plist |
| 稳定性 | ✅ 扩展持久运行（不像 Tab 会关闭） |
| 兼容性 | ❌ 仅 Chrome/Edge（Safari/Firefox 支持差） |

### A.5 架构 D：Service Worker + Cloudflare Tunnel

```
┌─────────────┐   HTTP/SSE    ┌──────────────┐  tunnel   ┌──────────────────┐
│ Claude Web  │ ────────────→ │ Cloudflare   │ ────────→ │ Browser          │
│ / Cursor    │               │ Tunnel       │           │ Service Worker   │
└─────────────┘               │ (ngrok 类似) │           │ (MCP server SSE) │
                              └──────────────┘           └──────────────────┘
```

| 维度 | 评估 |
|---|---|
| 能力完整度 | 🟡 Service Worker 限制（无 Canvas） |
| 部署复杂度 | ❌ 需要外部 tunnel（ngrok/cloudflare tunnel） |
| 用户体验 | ❌ 公网 URL 暴露安全风险 |
| 实现难度 | ❌ Service Worker 生命周期不稳定 |
| 稳定性 | ❌ Service Worker 会被浏览器回收 |
| 安全性 | ❌ 公网暴露 |

### A.6 架构 E：混合模式（A+B）—— 推荐

```
场景 1：浏览器打开时
   Claude → stdio → Bridge → WebSocket → Browser Runtime（完整能力）

场景 2：浏览器未打开时
   Claude → stdio → @lokvis/mcp-server → sharp + fs（降级模式）
```

**路由逻辑**：`ToolRouter` 启动时尝试连接浏览器，成功走架构 A，失败降级到架构 B。

| 维度 | 评估 |
|---|---|
| 能力完整度 | ✅ 浏览器打开时完整；降级时基础可用 |
| 部署复杂度 | ✅ 单一 npm 包，自适应 |
| 用户体验 | ✅ 最佳（浏览器可用时用浏览器，否则降级） |
| 实现难度 | 🟡 需实现两条路径（Bridge + Node Engine） |
| 稳定性 | ✅ 高（降级保底） |
| 推荐度 | **★★★★★** |

### A.7 架构选型决策矩阵

| 场景 | 推荐架构 | 理由 |
|---|---|---|
| 桌面 AI 客户端 + 用户打开浏览器 | E（浏览器模式） | 完整能力 + 可视化 |
| 桌面 AI 客户端 + 无浏览器 | E（降级模式） | 基础可用 |
| 服务器/CI/CD 自动化 | B | 无需浏览器 |
| 企业内网部署 | C | 扩展持久 + 安全 |
| Web AI 客户端集成 | D（Phase 2.5+） | 实验性 |

### A.8 Phase 2 实施建议

1. **优先实现架构 E**（混合模式）：覆盖 90% 场景
2. **Phase 3 考虑架构 C**（浏览器扩展）：为企业用户提供持久运行方案
3. **架构 D 暂不实现**：等 MCP Web 生态成熟
4. **架构 B 作为降级内置在 E 中**：不单独发布
