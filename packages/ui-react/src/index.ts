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
 * - `<HistoryPanel />` - History panel (W7.1, supports horizontal variant W9.1)
 * - `<CommandPalette />` - ⌘K command palette (W9.2)
 * - `<GlobalDropzone />` - Full-screen drag-drop with MIME validation (W9.3)
 * - `<CompareSlider />` - before/after comparison slider (W9.4)
 * - `<DownloadPanel />` - Workflow outputs download panel (W9.5)
 * - `<ThemeToggle />` - Dark mode toggle button (W9.7)
 * - `<PluginPanels />` - Plugin panel render slot (UI extension point)
 * - `registerPanelRenderer()` - Map PanelDefinition.component to a React component
 * - `useLokvis()` - React hook for initializing Runtime + plugins
 * - `useTheme()` - Dark mode hook with localStorage + system preference (W9.7)
 * - `useMediaQuery()` / `useBreakpoints()` - Responsive hooks (W9.8)
 * - `useCommandPalette()` - ⌘K shortcut registration hook (W9.2)
 */

// 引入设计 token(--lokvis-* CSS 变量),消费方无需手动 import styles.css。
// sideEffects: ["**/*.css"] 保证 bundler 不 tree-shake 此 import。
import '@lokvis/ui-core/styles.css';

export { useLokvis, type UseLokvisOptions, type UseLokvisResult } from './hooks/useLokvis.js';
export { useTheme, type UseThemeResult, type ThemeMode } from './hooks/useTheme.js';
export { useMediaQuery, useBreakpoints, type Breakpoints } from './hooks/useMediaQuery.js';
export { useWorkflows, FREE_WORKFLOW_LIMIT, PRO_WORKFLOW_LIMIT, type UseWorkflowsResult, type WorkflowSlot, type SaveWorkflowInput } from './hooks/useWorkflows.js';
export { useCustomPresets, FREE_PRESET_LIMIT, PRO_PRESET_LIMIT, readCustomPresetsFromStorage, writeCustomPresetsToStorage, genCustomPresetId, type UseCustomPresetsResult, type CustomSizePreset, type SavePresetInput } from './hooks/useCustomPresets.js';
export { useDebouncedRun, type UseDebouncedRunOptions, type UseDebouncedRunResult } from './hooks/useDebouncedRun.js';
export { useShareLink, type UseShareLinkResult, encodeWorkflowForShare, decodeWorkflowFromShare } from './hooks/useShareLink.js';
export { useWorkspaceStore, type WorkspaceState, type WorkspaceActions } from './store/index.js';

export { Workspace, type WorkspaceProps } from './components/Workspace.js';
export { ErrorBoundary, type ErrorBoundaryProps } from './components/ErrorBoundary.js';
export { AssetPanel } from './components/AssetPanel.js';
export { Canvas } from './components/Canvas.js';
export { Inspector } from './components/Inspector.js';
export { ExifPanel, type ExifPanelProps } from './components/ExifPanel.js';
export { PipelineBar } from './components/PipelineBar.js';
export { WorkflowEditor, type WorkflowEditorProps } from './components/WorkflowEditor.js';
export { ProgressBar, type ProgressBarProps } from './components/ProgressBar.js';
export { ErrorBanner, type ErrorBannerProps } from './components/ErrorBanner.js';
export { WorkflowTemplates, type WorkflowTemplatesProps } from './components/WorkflowTemplates.js';
export { Toolbar } from './components/Toolbar.js';
export { StatusBar } from './components/StatusBar.js';
export { ParamForm, type ParamFormProps } from './components/ParamForm.js';
export {
  registerParamWidget,
  getParamWidget,
  clearParamWidgets,
  resolveParamWidget,
  BUILT_IN_PARAM_WIDGETS,
  SliderWidget,
  TextareaWidget,
  JsonWidget,
  type ParamWidget,
  type ParamWidgetProps,
} from './components/param-widgets.js';
export { HistoryPanel, type HistoryPanelProps } from './components/HistoryPanel.js';
export { CommandPalette, useCommandPalette, type CommandPaletteProps, type UseCommandPaletteOptions } from './components/CommandPalette.js';
export { GlobalDropzone, type GlobalDropzoneProps } from './components/GlobalDropzone.js';
export { CompareSlider, type CompareSliderProps } from './components/CompareSlider.js';
export { DownloadPanel, type DownloadPanelProps } from './components/DownloadPanel.js';
export { ThemeToggle, type ThemeToggleProps } from './components/ThemeToggle.js';
export { ToolRunner, type ToolRunnerProps } from './components/ToolRunner.js';
export { PluginPanels, type PluginPanelsProps } from './components/PluginPanels.js';
export {
  registerPanelRenderer,
  getPanelRenderer,
  clearPanelRenderers,
  type PanelRenderer,
  type PanelRendererProps,
} from './panels/registry.js';

export {
  WORKFLOW_TEMPLATES,
  type WorkflowTemplate,
  type WorkflowTemplateNode,
  findTemplate,
} from './data/workflow-templates.js';

export type {
  WorkspaceEvent,
  NodeStatus,
} from './types.js';
