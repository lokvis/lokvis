/**
 * PluginPanels - 插件 Panel 渲染槽(UI 扩展点)
 *
 * 消费 store.panels(来自 runtime.listPanels(),由 panel:registered
 * 事件驱动刷新),按 PanelDefinition.location 过滤出本槽位的面板,
 * 经 show({ selectedAssets }) 谓词求值后,通过 panel renderer 注册表
 * (panels/registry.ts)把 component 标识解析为 React 组件渲染。
 *
 * 挂载位置(由 Workspace 决定):
 * - 'sidebar':   AssetPanel 下方(左栏)
 * - 'inspector': Inspector 下方(右栏)
 * - 'toolbar':   Toolbar rightExtra 区域
 * - 'modal':     Workspace 根级(渲染器自行管理弹层展示)
 *
 * 每个 Panel 独立包裹 ErrorBoundary:三方渲染器异常只影响自身,
 * 不会导致整个 Workspace 白屏。未注册的 component 标识静默跳过
 * (panel 数据先到、渲染器后注册的场景由 panel:registered 事件
 * 驱动重渲染,注册表命中后即显示)。
 */
import * as React from 'react';
import type { PanelDefinition } from '@lokvis/schema';
import { useWorkspaceStore } from '../store/index.js';
import { getPanelRenderer } from '../panels/registry.js';
import { ErrorBoundary } from './ErrorBoundary.js';

export interface PluginPanelsProps {
 /** 本槽位渲染的 Panel 位置 */
 location: PanelDefinition['location'];
 className?: string;
}

export function PluginPanels({ location, className }: PluginPanelsProps) {
 const panels = useWorkspaceStore((s) => s.panels);
 const selectedAssetId = useWorkspaceStore((s) => s.selectedAssetId);
 const runtime = useWorkspaceStore((s) => s.runtime);

 // PanelDefinition.show 的 context 是 selectedAssets: string[](复数),
 // 与 store 的单选中模型对齐:有选中时为单元素数组,否则空数组。
 const selectedAssets = React.useMemo(
  () => (selectedAssetId ? [selectedAssetId] : []),
  [selectedAssetId]
 );

 const visible = panels.filter(
  (p) => p.location === location && (!p.show || p.show({ selectedAssets }))
 );
 if (visible.length === 0) return null;

 return (
  <div className={className} data-lokvis-panels={location}>
   {visible.map((panel) => {
    const Renderer = getPanelRenderer(panel.component);
    if (!Renderer) return null;
    return (
     <ErrorBoundary key={panel.id}>
      <Renderer panel={panel} selectedAssets={selectedAssets} runtime={runtime} />
     </ErrorBoundary>
    );
   })}
  </div>
 );
}
