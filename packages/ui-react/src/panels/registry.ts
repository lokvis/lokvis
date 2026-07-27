/**
 * Panel Renderer 注册表(UI 扩展点)
 *
 * PanelDefinition.component 是字符串标识("由 UI 层解析",见
 * @lokvis/schema PanelDefinition)。runtime 只持有数据定义,不持有
 * React 组件(依赖反转);消费方在应用启动时通过
 * registerPanelRenderer() 把 component 标识映射到 React 组件,
 * PluginPanels 组件在渲染时按标识解析。
 *
 * @example
 * ```tsx
 * import { registerPanelRenderer, Workspace } from '@lokvis/ui-react';
 *
 * registerPanelRenderer('my-plugin.histogram', ({ panel, selectedAssets }) => (
 *   <HistogramPanel panelId={panel.id} assets={selectedAssets} />
 * ));
 *
 * <Workspace plugins={[myPlugin()]} />
 * ```
 */
import type * as React from 'react';
import type { PanelDefinition } from '@lokvis/schema';
import type { LokvisRuntime } from '@lokvis/runtime';

/** Panel 渲染器接收的 props */
export interface PanelRendererProps {
  /** 插件注册的 Panel 定义(id/name/location/component/show) */
  panel: PanelDefinition;
  /** 当前选中的资产 ID 列表(与 PanelDefinition.show 的 context 一致) */
  selectedAssets: string[];
  /** 当前 Runtime 实例(供渲染器读写资产/执行能力) */
  runtime: LokvisRuntime | null;
}

/** Panel 渲染器:普通 React 组件 */
export type PanelRenderer = React.ComponentType<PanelRendererProps>;

/**
 * 模块级注册表。与 Workspace store 的单例语义一致(同一应用内
 * 所有 Workspace 共享 Panel 渲染器定义)。
 */
const renderers = new Map<string, PanelRenderer>();

/**
 * 注册 Panel 渲染器(component 标识 → React 组件)。
 *
 * 同 component 重复注册覆盖前者(支持热更新)。
 * @returns 反注册函数:仅当当前注册仍是本次传入的 renderer 时移除
 *   (避免误删后注册者)。
 */
export function registerPanelRenderer(
  component: string,
  renderer: PanelRenderer
): () => void {
  renderers.set(component, renderer);
  return () => {
    if (renderers.get(component) === renderer) renderers.delete(component);
  };
}

/** 按 component 标识解析渲染器;未注册返回 undefined(调用方跳过渲染) */
export function getPanelRenderer(component: string): PanelRenderer | undefined {
  return renderers.get(component);
}

/** 清空注册表(仅供测试使用) */
export function clearPanelRenderers(): void {
  renderers.clear();
}
