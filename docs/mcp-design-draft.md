# MCP Server 接口设计草案(ADR-011 衔接)

> 状态:**评审通过**(W12.8,2026-07-04;ADR-011 升级为 Accepted)
> 日期:2026-07-04
> 关联:ADR-011(MCP server 状态已升级为 Accepted)、PROJECT_PLAN.md W11.10 / W12.8

## 1. 背景与目标

Lokvis Runtime 已实现 `toMcpManifest()`(W4.2),能把注册的 capability 自动描述为
MCP tool manifest。本草案定义**完整的 MCP server 接口**,让 AI 客户端
(Claude Desktop / Cursor / VS Code MCP)能驱动 Lokvis 处理本地图片。

**设计目标:**

1. **本地优先**:MCP server 跑在用户机器上,文件不离开本地(与 Lokvis 隐私承诺一致)
2. **能力驱动**:tool 清单由 `toMcpManifest()` 动态生成,新增 capability 自动可见
3. **安全可控**:private 能力不暴露;batch-only 能力仅在批量模式暴露
4. **最小实现**:Phase 1 只做 stdio 传输,不做 HTTP/SSE

**非目标:**

- 不做 cloud MCP(云端处理,Pro 功能,Phase 2+)
- 不做 MCP server 的 npm 独立发版(Phase 1 内嵌 CLI / playground)

## 2. 现有基础

### 2.1 已实现(schema + runtime)

- `@lokvis/schema` 定义 `McpManifest` / `McpToolManifest` / `McpResourceManifest` 类型
- `@lokvis/runtime` 实现 `runtime.toMcpManifest({ batchMode })`,自动遍历
  `CapabilityRegistry`,把每个 capability 转为 MCP tool(含 inputSchema JSON Schema)
- `mcpExposure` 字段控制可见性:`public` / `batch-only` / `private`

### 2.2 tool 命名约定

```
capability: image.resize  →  tool: lokvis_image_resize
capability: image.compress → tool: lokvis_image_compress
```

### 2.3 resources(已定义)

| URI | 名称 | 说明 |
|---|---|---|
| `lokvis://capabilities` | Capabilities | 列出所有可用能力及参数 schema |
| `lokvis://workflows` | Workflows | 列出已保存的工作流(本地槽位) |

## 3. Tools 清单(基于 W5-W8 已实现能力)

> 以下 tool 由 `toMcpManifest()` 自动生成,无需手写。此处列出预期清单供评审。

### 3.1 image 域(public,默认暴露)

| tool name | 对应 capability | inputSchema 关键参数 |
|---|---|---|
| `lokvis_image_resize` | image.resize | width, height, fit(cover/contain/inside) |
| `lokvis_image_compress` | image.compress | format(jpeg/png/webp/avif), quality(1-100) |
| `lokvis_image_convert` | image.convert | format |
| `lokvis_image_crop` | image.crop | x, y, width, height |
| `lokvis_image_rotate` | image.rotate | angle, flipH, flipV |
| `lokvis_image_watermark` | image.watermark | text, position, opacity |
| `lokvis_image_filter` | image.filter | preset(bw/sepia/blur) |

### 3.2 batch 域(batch-only,仅 batchMode=true)

| tool name | 对应 capability | 说明 |
|---|---|---|
| `lokvis_batch_process` | (合成) | 批量处理多文件,免费 10 / Pro 无限 |

### 3.3 元 tool(控制类,手动定义)

这些 tool 不对应单一 capability,而是 Runtime 级别操作:

| tool name | 说明 | inputSchema |
|---|---|---|
| `lokvis_run_workflow` | 执行完整工作流(多节点) | `workflow`(Workflow JSON), `inputAssetIds`(string[]) |
| `lokvis_get_asset` | 获取资产元数据(不返回二进制,仅 metadata) | `assetId`(string) |
| `lokvis_export_asset` | 导出资产为指定格式,返回本地文件路径 | `assetId`, `format`, `quality` |
| `lokvis_undo` / `lokvis_redo` | 历史栈操作 | `workflowId` |
| `lokvis_cancel` | 取消运行中的工作流 | `workflowId` |

**设计要点:**

- `lokvis_run_workflow` 是核心 tool:AI 可构造完整 workflow(含多节点)一次执行
- 单 capability tool(如 `lokvis_image_resize`)是便捷快捷方式,内部等价于单节点 workflow
- 二进制数据不通过 MCP 返回(太大会阻塞 LLM 上下文);改为返回 assetId + 本地文件路径

## 4. Resources 清单

除已定义的两个 resource 外,新增:

| URI | 名称 | 说明 | MIME |
|---|---|---|---|
| `lokvis://capabilities` | Capabilities | 已实现 | application/json |
| `lokvis://workflows` | Workflows | 已实现 | application/json |
| `lokvis://asset/{id}/metadata` | Asset Metadata | 单个资产的元数据 | application/json |
| `lokvis://asset/{id}/thumbnail` | Asset Thumbnail | 缩略图 data URI | image/png |

**资源读取策略:**

- `lokvis://capabilities` 返回完整能力清单(含 params JSON Schema),供 AI 理解参数
- `lokvis://workflows` 返回本地保存的 5 个工作流槽位,供 AI 推荐复用
- 缩略图以 data URI 返回,避免文件系统访问;大图只返回 metadata

## 5. Prompts 清单(草案)

MCP prompts 是预定义的提示模板,AI 客户端可调用。Lokvis 提供:

| prompt name | 说明 | 参数 |
|---|---|---|
| `lokvis_optimize_for_web` | "优化这张图片用于网页" | `assetId`, `targetWidth`(默认 1920) |
| `lokvis_batch_social_resize` | "批量调整尺寸为社媒规格" | `assetIds[]`, `platform`(instagram/twitter/...) |
| `lokvis_add_watermark` | "给图片加水印" | `assetId`, `text`, `position` |
| `lokvis_compress_to_size` | "压缩到目标体积" | `assetId`, `targetKB` |

**实现方式:**

prompt 模板返回一段自然语言 + 结构化 workflow JSON,AI 可直接调用
`lokvis_run_workflow` 执行,或调整参数后执行。

## 6. 传输方式

### Phase 1:stdio(唯一支持)

```
AI Client ←stdio→ lokvis mcp-server ←→ Runtime(本地)
```

- 启动:`lokvis mcp` 或 `npx @lokvis/cli mcp`
- 配置(Claude Desktop 示例):

```json
{
  "mcpServers": {
    "lokvis": {
      "command": "npx",
      "args": ["-y", "@lokvis/cli", "mcp"]
    }
  }
}
```

**优点:** 零配置,文件不经过网络。**限制:** 仅本地 AI 客户端可用。

### Phase 2+:HTTP/SSE(延后)

- `apps/cloud` 提供 MCP HTTP endpoint,Pro 用户远程驱动
- 本文档不展开,留待 Phase 2 设计

## 7. 安全性

| 维度 | 策略 |
|---|---|
| 文件隐私 | stdio 模式下文件全程本地,不上传 |
| 能力可见性 | `mcpExposure='private'` 的能力不出现在 manifest |
| 批量误用 | `batch-only` 能力仅在 `batchMode=true` 暴露 |
| 资产引用 | tool 返回 assetId 而非二进制,避免 LLM 上下文膨胀 |
| 路径逃逸 | `lokvis_export_asset` 仅写入用户指定目录,禁止系统路径 |

## 8. 与 cloud MCP 的区别

| 维度 | open MCP(stdio) | cloud MCP(HTTP) |
|---|---|---|
| 运行位置 | 用户本地 | cloud 服务器 |
| 文件处理 | 本地引擎(Canvas/WASM) | cloud 引擎(服务器侧) |
| 收费 | 免费 | Pro 订阅 |
| 能力范围 | 全部 capability | 子集(cloud 支持的) |
| Phase | Phase 1(W11.10 草案,实现 W17+) | Phase 2+ |

## 9. 实现路径

### 9.1 Phase 1 范围(W17-W20,M5)

- [ ] `@lokvis/cli` 新增 `mcp` 子命令:启动 stdio MCP server
- [ ] `@lokvis/mcp-server` 包(新建):消费 `toMcpManifest()`,实现 MCP 协议
  (JSON-RPC 2.0 over stdio)
- [ ] 实现 5 个元 tool:`run_workflow` / `get_asset` / `export_asset` / `undo` / `cancel`
- [ ] 实现 4 个 prompts
- [ ] 集成测试:用 Claude Desktop 配置验证 5 个典型场景
- [ ] 文档:开发者指南 `apps/docs` 添加 MCP 集成页

### 9.2 Phase 2+(延后)

- HTTP/SSE 传输(cloud)
- MCP 资源订阅(asset 更新推送)
- 更多 prompts(基于用户反馈)

## 10. 开放问题(W12.8 评审已决议)

> 2026-07-04 W12.8 评审:5 个开放问题全部决议,详见 [ADR-011 W12.8 评审记录](./adr/011-mcp-server.md#w128-评审记录2026-07-04)。

1. **asset 传递方式**:tool 间如何传递 assetId?
   **决议:显式 `inputAssetIds`**——隐式"当前选中资产"上下文会造成 MCP 客户端与服务端状态耦合;
   显式传递符合 MCP 无状态约定,便于 AI 理解与重放。

2. **workflow JSON 校验**:AI 生成的 workflow 可能不合法,是否在 `lokvis_run_workflow`
   内部强制 `validateWorkflow()`?
   **决议:强制校验 + 结构化错误返回**——校验失败时返回 MCP 兼容的错误结构
   (`isError: true` + text content 含错误路径与修复建议),而非让 executor 抛运行时异常。

3. **历史栈共享**:多个 AI 会话是否共享历史栈?
   **决议:不共享,每个 stdio 进程独立 Runtime**——共享历史会引入跨会话状态污染与权限边界问题;
   独立 Runtime 与"每个 MCP 客户端连接独立进程"的部署模型一致。

4. **Pro 门控**:MCP 是否尊重 `isPro`?
   **决议:尊重,batch tool 免费模式限 10 文件**——与 Workspace UI / CLI 的 Pro 门控一致;
   门控在 Runtime 层而非 MCP 层,Pro 无限。

5. **错误信息语言**:tool 错误返回中文还是英文?
   **决议:英文**——MCP 客户端国际化更友好,AI 可基于英文错误信息自主修复策略;
   中文说明保留在 tool `description` 与 `prompts` 模板中。

## 11. 后续行动

| # | 行动 | 负责人 | 截止 | 状态 |
|---|---|---|---|---|
| 1 | 本草案评审(W12.8) | 团队 | W12 | ✅ 完成(2026-07-04) |
| 2 | ADR-011 状态确认:从"草案"升级为"接受"或"修订" | 架构 | W12 | ✅ Accepted(2026-07-04) |
| 3 | `@lokvis/mcp-server` 包骨架(W17) | 主创 | W17 | ⏭️ 骨架已存在,实际实现 Phase 2 W1-W2 |
| 4 | stdio 协议实现 + Claude Desktop 验证(W18) | 主创 | W18 | ⏭️ Phase 2 W3-W10 |

---

**变更记录:**

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-07-04 | 0.1 | 初稿(W11.10),基于 toMcpManifest() 现有实现 + W5-W8 能力清单 |
| 2026-07-04 | 0.2 | W12.8 评审通过:5 个开放问题全部决议;ADR-011 升级为 Accepted;状态从「草案」改为「评审通过」 |
