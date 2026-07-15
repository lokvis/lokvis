/**
 * ToolRouter:tool 调用的路由层(混合架构 E 的核心)。
 *
 * 路由优先级:
 *   1. 浏览器连接模式(完整能力):若 BrowserBridge 已连接,优先转发到浏览器
 *   2. Node 降级模式(基础能力):浏览器未连接时,用 Node engine(sharp 等)
 *   3. 都不可用:抛错并提示用户打开 lokvis.app
 *
 * 详见 docs/AI生态冲击调整方案.md §3.5。
 *
 * 实装状态(2026-07-15):BrowserBridge(WebSocket)、NodeEngineAdapter
 * (sharp + pdf-lib)、ToolRouter 路由逻辑均已实装。当前 image/pdf tool
 * 直接经 NodeEngineAdapter 调用 sharp/pdf-lib,未经 runtime capability
 * 系统(见 TD-1.3 / TD-1.4,Phase 2 W7-W8 改造)。
 */

/**
 * Node.js 环境的 engine 适配器(降级模式)。
 * 用 sharp 替代 Canvas、pdf-lib 替代浏览器 PDF API。
 * video/audio 不支持(浏览器专属)。
 */
export interface NodeEngineAdapter {
  /** 检查是否支持某 capability */
  supports(capability: string): boolean;
  /** 执行 capability */
  execute(
    capability: string,
    params: Record<string, unknown>
  ): Promise<unknown>;
}

/**
 * ToolRouter:根据浏览器连接状态选择执行路径。
 *
 * @example
 * ```ts
 * const router = new ToolRouter(browserBridge, nodeEngine);
 * const result = await router.execute('lokvis_compress_image', { input_path: '/a.jpg' });
 * ```
 */
export class ToolRouter {
  constructor(
    private browserBridge: { isConnected(): boolean; callTool(tool: string, params: unknown): Promise<unknown> },
    private nodeEngine: NodeEngineAdapter
  ) {}

  async execute(tool: string, params: Record<string, unknown>): Promise<unknown> {
    const capability = toolToCapability(tool);

    // 1. 浏览器优先(完整能力)
    if (this.browserBridge.isConnected()) {
      try {
        return await this.browserBridge.callTool(tool, params);
      } catch (err) {
        console.error(
          `[lokvis] Browser call failed: ${err}, falling back to Node`
        );
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

/**
 * 把 MCP tool 名转换回 Lokvis capability 名(反向推断)。
 *
 * 与 `toMcpManifest()` 的默认 tool 名约定对齐:
 *   `lokvis_${capability.replace(/\./g, '_')}`,即 `lokvis_<domain>_<verb>`
 *   (domain 在前,verb 在后,点号替换为下划线)。
 *
 * 如 `lokvis_image_resize` → `image.resize`、`lokvis_pdf_merge` → `pdf.merge`、
 * `lokvis_image_batch_process` → `image.batch_process`。
 *
 * 注意:本函数仅能可靠反推「默认 tool 名」(domain 在前的形式)。
 * 显式 `mcpToolName` 覆盖若不遵循 `lokvis_<domain>_<verb>` 模式
 * (如 `lokvis_compress_image`,verb 在前),则无法靠字符串反推。
 * Phase 2 应由 ToolRouter 维护 `toolName → capability` 映射表
 * (基于 manifest 构建),而非依赖字符串推断。
 */
export function toolToCapability(tool: string): string {
  // 去掉 `lokvis_` 前缀
  const rest = tool.startsWith('lokvis_') ? tool.slice('lokvis_'.length) : tool;
  // 按下划线分割:首段是 domain,其余用下划线还原为 verb
  // (用下划线而非点号,以正确还原多词 verb,如 batch_process)
  const parts = rest.split('_');
  if (parts.length < 2) return rest;
  const domain = parts[0]!;
  const verb = parts.slice(1).join('_');
  return `${domain}.${verb}`;
}
