/**
 * @lokvis/ui-react
 *
 * Lokvis Workspace UI - React workspace component library.
 *
 * Provides:
 * - `<Workspace />` - Ready-to-use local-first workspace
 * - `<AssetPanel />` - Asset panel (import / select / preview)
 * - `<Canvas />` - Canvas preview area
 * - `<Inspector />` - Right panel for capability configuration
 * - `<PipelineBar />` - Workflow pipeline step bar
 * - `<Toolbar />` - Top toolbar
 * - `<StatusBar />` - Bottom status bar
 * - `useLokvis()` - React hook for initializing Runtime + plugins
 */

export { useLokvis, type UseLokvisOptions, type UseLokvisResult } from './hooks/useLokvis.js';
export { useWorkspaceStore, type WorkspaceState, type WorkspaceActions } from './store/index.js';

export { Workspace, type WorkspaceProps } from './components/Workspace.js';
export { AssetPanel } from './components/AssetPanel.js';
export { HistoryPanel, type HistoryPanelProps } from './components/HistoryPanel.js';
export { Canvas } from './components/Canvas.js';
export { Inspector } from './components/Inspector.js';
export { ExifPanel, type ExifPanelProps } from './components/ExifPanel.js';
export { PipelineBar } from './components/PipelineBar.js';
export { Toolbar } from './components/Toolbar.js';
export { StatusBar } from './components/StatusBar.js';
export { ParamForm, type ParamFormProps } from './components/ParamForm.js';

export type {
  WorkspaceEvent,
  NodeStatus,
} from './types.js';
