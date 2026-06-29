/**
 * @lokvis/ui-react
 *
 * Lokvis Workspace UI - 完整的 React 工作台组件库。
 *
 * 提供：
 * - `<Workspace />`：开箱即用的本地优先图像工作台
 * - `<AssetPanel />`：资产面板（导入 / 选择 / 预览）
 * - `<Canvas />`：画布预览
 * - `<Inspector />`：右侧能力配置面板
 * - `<HistoryPanel />`：处理历史与撤销
 * - `<Toolbar />`：顶部工具栏
 * - `useLokvis()`：初始化 Runtime + 加载插件的 React Hook
 *
 * 基于 @lokvis/ui-core 设计系统。Runtime 永远不知道 React。
 *
 * 参考 docs/whitepaper/04-技术架构设计.md 第八节「UI Layer」。
 */

export { useLokvis, type UseLokvisOptions, type UseLokvisResult } from './hooks/useLokvis.js';
export { useWorkspaceStore, type WorkspaceState, type WorkspaceActions } from './store.js';

export { Workspace, type WorkspaceProps } from './components/Workspace.js';
export { AssetPanel } from './components/AssetPanel.js';
export { Canvas } from './components/Canvas.js';
export { Inspector } from './components/Inspector.js';
export { HistoryPanel } from './components/HistoryPanel.js';
export { Toolbar } from './components/Toolbar.js';
export { StatusBar } from './components/StatusBar.js';
export { ParamForm, type ParamFormProps } from './components/ParamForm.js';

export type {
  WorkspaceEvent,
  NodeStatus,
} from './types.js';
