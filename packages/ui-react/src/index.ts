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
 * - `useLokvis()` - React hook for initializing Runtime + plugins
 * - `useTheme()` - Dark mode hook with localStorage + system preference (W9.7)
 * - `useMediaQuery()` / `useBreakpoints()` - Responsive hooks (W9.8)
 * - `useCommandPalette()` - ⌘K shortcut registration hook (W9.2)
 */

export { useLokvis, type UseLokvisOptions, type UseLokvisResult } from './hooks/useLokvis.js';
export { useTheme, type UseThemeResult, type ThemeMode } from './hooks/useTheme.js';
export { useMediaQuery, useBreakpoints, type Breakpoints } from './hooks/useMediaQuery.js';
export { useWorkspaceStore, type WorkspaceState, type WorkspaceActions } from './store/index.js';

export { Workspace, type WorkspaceProps } from './components/Workspace.js';
export { AssetPanel } from './components/AssetPanel.js';
export { Canvas } from './components/Canvas.js';
export { Inspector } from './components/Inspector.js';
export { ExifPanel, type ExifPanelProps } from './components/ExifPanel.js';
export { PipelineBar } from './components/PipelineBar.js';
export { Toolbar } from './components/Toolbar.js';
export { StatusBar } from './components/StatusBar.js';
export { ParamForm, type ParamFormProps } from './components/ParamForm.js';
export { HistoryPanel, type HistoryPanelProps } from './components/HistoryPanel.js';
export { CommandPalette, useCommandPalette, type CommandPaletteProps } from './components/CommandPalette.js';
export { GlobalDropzone, type GlobalDropzoneProps } from './components/GlobalDropzone.js';
export { CompareSlider, type CompareSliderProps } from './components/CompareSlider.js';
export { DownloadPanel, type DownloadPanelProps } from './components/DownloadPanel.js';
export { ThemeToggle, type ThemeToggleProps } from './components/ThemeToggle.js';

export type {
  WorkspaceEvent,
  NodeStatus,
} from './types.js';
