/**
 * ToolRouter:tool 调用的路由层(混合架构 E 的核心)。
 *
 * 路由优先级:
 *   1. 浏览器连接模式(完整能力):若 BrowserBridge 已连接,优先转发到浏览器
 *   2. Node 降级模式(基础能力):浏览器未连接时,直接调用 tool handler
 *      (image / pdf tool handler 均经 runtime.run() 走完整 capability 系统)
 *   3. 都不可用:抛错并提示用户打开 lokvis.app
 *
 * 详见 docs/AI生态冲击调整方案.md §3.5。
 *
 * 实装状态(2026-07-18):image + pdf tools 均经 runtime.run(workflow, inputs)
 * 走完整 capability 系统(TD-1.1 / TD-1.3 / TD-1.4 已清偿)。NodeEngineAdapter
 * 中间层已移除,tool handler 自身就是完整执行单元。
 */

/** Tool handler 签名:接收 params,返回任意结果(通常是 McpToolResult) */
export type ToolHandler = (
  params: Record<string, unknown>
) => Promise<unknown>;

/**
 * ToolRouter:根据浏览器连接状态选择执行路径。
 *
 * Node 降级路径直接调用 `toolHandlers.get(tool)(params)`,
 * 不再做 capability 名转换 —— tool handler 内部自行决定执行方式
 * (image handler 走 runtime.run + workflow,pdf handler 直调 engine)。
 *
 * @example
 * ```ts
 * const handlers = new Map([['lokvis_image_resize', resizeHandler]]);
 * const router = new ToolRouter(browserBridge, handlers);
 * const result = await router.execute('lokvis_image_resize', { input_path: '/a.jpg' });
 * ```
 */
export class ToolRouter {
  constructor(
    private browserBridge: {
      isConnected(): boolean;
      callTool(tool: string, params: unknown): Promise<unknown>;
    },
    private toolHandlers: Map<string, ToolHandler>
  ) {}

  async execute(
    tool: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
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

    // 2. Node 降级:直接调用 tool handler
    const handler = this.toolHandlers.get(tool);
    if (handler) {
      return await handler(params);
    }

    // 3. 都不可用
    throw new Error(
      `Tool ${tool} not available. ` +
        (this.browserBridge.isConnected()
          ? 'Browser runtime does not support this capability.'
          : 'Browser not connected (open lokvis.app) and Node.js does not support this tool.')
    );
  }
}
