/**
 * NodeEngineAdapter 的 image 域实现(M2.3)。
 *
 * 把 MCP tool handler(imageResize / imageCompress / imageConvert,基于 sharp)
 * 包装为 NodeEngineAdapter 接口,供 ToolRouter 在浏览器未连接时降级调用。
 *
 * capability ↔ tool 名映射复用 router.ts 的 toolToCapability:
 *   lokvis_image_resize → image.resize
 *
 * 参考:docs/reports/20260712-task-plan.md §M2.3
 */

import type { NodeEngineAdapter } from './router.js';
import { toolToCapability } from './router.js';

type ToolHandler = (params: Record<string, unknown>) => Promise<unknown>;

/** tool 注册记录(与 tools/image.ts 的 getImageToolRegistrations 对齐) */
export interface ToolRegistration {
  name: string;
  handler: ToolHandler;
}

/**
 * Image 域 NodeEngineAdapter:用现有 sharp tool handler 支撑 Node 降级路径。
 *
 * @example
 * ```ts
 * const adapter = new ImageNodeEngineAdapter(getImageToolRegistrations());
 * adapter.supports('image.resize'); // true
 * adapter.supports('video.trim');   // false
 * ```
 */
export class ImageNodeEngineAdapter implements NodeEngineAdapter {
  private readonly handlers = new Map<string, ToolHandler>();

  constructor(registrations: ToolRegistration[]) {
    for (const reg of registrations) {
      const capability = toolToCapability(reg.name);
      this.handlers.set(capability, reg.handler);
    }
  }

  supports(capability: string): boolean {
    return this.handlers.has(capability);
  }

  async execute(
    capability: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const handler = this.handlers.get(capability);
    if (!handler) {
      throw new Error(`Node engine does not support capability: ${capability}`);
    }
    return handler(params);
  }

  /** 已支持的 capability 列表(测试/调试用) */
  supportedCapabilities(): string[] {
    return Array.from(this.handlers.keys());
  }
}
