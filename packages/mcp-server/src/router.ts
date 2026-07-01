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
 * 状态:Phase 2 骨架。BrowserBridge 与 NodeEngineAdapter 的具体实现
 * 在 Phase 2 W3-W4 完成。
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
 * 把 MCP tool 名转换回 Lokvis capability 名。
 * `lokvis_compress_image` → `image.compress`(反向推断)。
 *
 * 约定:`lokvis_<verb>_<domain>` → `<domain>.<verb>`
 * 如 `lokvis_resize_image` → `image.resize`、`lokvis_merge_pdf` → `pdf.merge`。
 */
export function toolToCapability(tool: string): string {
  // 去掉 `lokvis_` 前缀
  const rest = tool.startsWith('lokvis_') ? tool.slice('lokvis_'.length) : tool;
  // 按下划线分割,最后一段是 domain,其余拼接为 verb
  const parts = rest.split('_');
  if (parts.length < 2) return rest;
  const domain = parts[parts.length - 1]!;
  const verb = parts.slice(0, -1).join('.');
  return `${domain}.${verb}`;
}
