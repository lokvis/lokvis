/**
 * @lokvis/plugin-sdk
 *
 * Plugin 开发 SDK。Plugin 只能看到 Runtime API，看不到 React/Redux/Cloud。
 * 通过 definePlugin 定义插件，安装时通过 PluginContext 注册能力。
 */

import type {
  Capability,
  CapabilityImplementation,
  PluginConfig,
  PluginContext,
  PluginInstaller,
  PluginPermission,
  PanelDefinition,
} from '@lokvis/schema';

export type {
  Capability,
  CapabilityImplementation,
  PluginConfig,
  PluginContext,
  PluginInstaller,
  PluginPermission,
  PanelDefinition,
};

/**
 * 定义一个 Lokvis Plugin
 *
 * @example
 * ```ts
 * export default definePlugin({
 *   name: 'lokvis-image-tools',
 *   version: '1.0.0',
 *   capabilities: [
 *     {
 *       name: 'image.resize',
 *       description: 'Resize image to specified dimensions',
 *       inputTypes: ['image'],
 *       outputTypes: ['image'],
 *       params: [
 *         { name: 'width', type: 'number', required: false },
 *         { name: 'height', type: 'number', required: false },
 *         { name: 'fit', type: 'enum', values: ['cover', 'contain', 'fill'] }
 *       ],
 *       performance: 'fast'
 *     }
 *   ],
 *   engine: 'squoosh'
 * });
 * ```
 */
export function definePlugin(
  config: PluginConfig,
  installer?: (ctx: PluginContext) => void | Promise<void>
): { config: PluginConfig; install: PluginInstaller } {
  return {
    config,
    install: async (ctx: PluginContext) => {
      // 注册能力声明（由 Runtime 在加载插件时调用）
      // 注意：能力实现的注册由 installer 完成
      if (installer) {
        await installer(ctx);
      }
    },
  };
}

/** 便捷工具：创建能力实现注册函数 */
export function createCapabilityImpl(
  capability: string,
  engine: string,
  execute: CapabilityImplementation['execute']
): CapabilityImplementation {
  return { capability, engine, execute };
}

/** 便捷工具：创建 Panel 定义 */
export function definePanel(panel: PanelDefinition): PanelDefinition {
  return panel;
}
