/**
 * Panels slice —— 插件 Panel 定义列表(UI 扩展点)
 *
 * Plugin 通过 ctx.registerPanel() 把 PanelDefinition 注册到 Runtime,
 * Runtime 发射 panel:registered 事件。本 slice 在 init 与事件触发时
 * 调用 runtime.listPanels() 同步定义列表,PluginPanels 组件按
 * PanelDefinition.location 渲染到 Workspace 对应区域。
 *
 * 依赖反转:runtime 只持有数据定义;React 组件解析在 ui-react 的
 * panel renderer 注册表(见 ../panels/registry.ts),由消费方注册。
 */
import type { StateCreator } from 'zustand';
import type { PanelDefinition } from '@lokvis/schema';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';

export interface PanelsSlice
  extends Pick<WorkspaceState, 'panels'>,
    Pick<WorkspaceActions, 'refreshPanels'> {}

export const createPanelsSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  PanelsSlice
> = (set, get) => ({
  panels: [] as PanelDefinition[],

  refreshPanels() {
    const { runtime } = get();
    if (!runtime) return;
    set({ panels: runtime.listPanels() });
  },
});
