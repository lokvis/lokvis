/**
 * Workspace - 完整工作台组件
 *
 * W9 布局:
 * ┌──────────────────────────────────────────────┐
 * │ Toolbar │
 * ├──────┬──────────────┬───────────────────────┤
 * │Asset │ Canvas │ Inspector │
 * │Panel │ (center) │ (right) │
 * ├──────┴──────────────┴───────────────────────┤
 * │ PipelineBar │
 * ├──────────────────────────────────────────────┤
 * │ HistoryPanel (horizontal, W9.1) │
 * ├──────────────────────────────────────────────┤
 * │ DownloadPanel (W9.5,条件渲染) │
 * ├──────────────────────────────────────────────┤
 * │ StatusBar │
 * └──────────────────────────────────────────────┘
 *
 * W9 集成:
 * - 9.1 HistoryPanel 移到底部(horizontal variant)
 * - 9.2 CommandPalette(⌘K)挂载在 Workspace 内
 * - 9.3 GlobalDropzone 全屏拖拽 + MIME 校验
 * - 9.4 Canvas 内置 CompareSlider(before/after)
 * - 9.5 DownloadPanel 在 HistoryPanel 下方,有 outputs 时显示
 * - 9.6 StatusBar 已增强(当前工具/进度/在线)
 * - 9.7 ThemeToggle 通过 Toolbar rightExtra 挂载
 * - 9.8 响应式:移动端折叠为 drawer 模式
 *
 * 通过 useLokvis 自动初始化 Runtime 与插件。
 *
 * @example
 * ```tsx
 * import { Workspace } from '@lokvis/ui-react';
 * import imageToolsPlugin from '@lokvis/plugin-image';
 *
 * <Workspace plugins={[imageToolsPlugin()]} />
 * ```
 */

import * as React from 'react';
import { ConfirmDialog, Icon } from '@lokvis/ui-core';
import { useLokvis, type UseLokvisOptions } from '../hooks/useLokvis.js';
import { useBreakpoints } from '../hooks/useMediaQuery.js';
import { Toolbar } from './Toolbar.js';
import { AssetPanel } from './AssetPanel.js';
import { HistoryPanel } from './HistoryPanel.js';
import { Canvas } from './Canvas.js';
import { Inspector } from './Inspector.js';
import { PipelineBar } from './PipelineBar.js';
import { WorkflowEditor } from './WorkflowEditor.js';
import { ProgressBar } from './ProgressBar.js';
import { ErrorBanner } from './ErrorBanner.js';
import { StatusBar } from './StatusBar.js';
import { DownloadPanel } from './DownloadPanel.js';
import { CommandPalette, useCommandPalette } from './CommandPalette.js';
import { GlobalDropzone } from './GlobalDropzone.js';
import { ThemeToggle } from './ThemeToggle.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { PluginPanels } from './PluginPanels.js';
import { useShareLink } from '../hooks/useShareLink.js';
import { useFocusedAutoSelect } from '../hooks/useFocusedAutoSelect.js';
import { useWorkspaceStore } from '../store/index.js';
import type { Language } from '../i18n/config.js';
import {
 WorkspaceI18nProvider,
 useWorkspaceI18nContext,
 type WorkspaceTranslations,
} from '../i18n/WorkspaceI18nProvider.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { useWorkspaceTranslations } from '../i18n/utils.js';

export interface WorkspaceProps extends UseLokvisOptions {
 /** 顶部标题 */
 title?: string;
 /**
  * 显式 UI 语言（优先级最高）。
  * 不传时依次回退:外层 WorkspaceI18nProvider → document.documentElement.lang → URL 路径前缀。
  */
 locale?: Language;
 /**
  * 翻译覆盖表（key → language → 文案）,部分覆盖包内 6 语言字典。
  * 不传时继承外层 WorkspaceI18nProvider 的 translations。
  */
 translations?: WorkspaceTranslations;
 /** 是否显示状态栏（默认 true） */
 showStatusBar?: boolean;
 /** 是否显示历史面板（默认 true,W7.1） */
 showHistoryPanel?: boolean;
 /** 是否启用全屏拖拽导入（默认 true,W9.3） */
 enableGlobalDropzone?: boolean;
 /** 是否启用 Command Palette ⌘K（默认 true,W9.2） */
 enableCommandPalette?: boolean;
 /** 是否启用 ThemeToggle（默认 true,W9.7） */
 enableThemeToggle?: boolean;
 /** 是否启用 CompareSlider（默认 true,W9.4） */
 enableCompare?: boolean;
 /** 是否启用 DownloadPanel（默认 true,W9.5） */
 enableDownloadPanel?: boolean;
 /** 是否启用拖拽式 WorkflowEditor（默认 false,W10.4;关闭则用只读 PipelineBar） */
 enableWorkflowEditor?: boolean;
 /** 是否启用 ProgressBar + Cancel 按钮（默认 true,W11.6） */
 enableProgressBar?: boolean;
 /** 是否启用 ErrorBanner 错误信息横幅（默认 true,W11.3） */
 enableErrorBanner?: boolean;
 /** 是否从 URL ?workflow= 参数加载分享工作流（默认 true,W11.5） */
 enableShareLink?: boolean;

 /**
  * 初始化时自动导入的资产列表。
  * Runtime 就绪后,通过 runtime.importAsset() 逐个导入。
  */
 initialAssets?: Array<{ blob: Blob; name: string }>;
 /**
  * 初始化时预选的能力名称(自动添加到工作流节点)。
  */
 initialCapability?: string;
 /**
  * 初始化时预填的参数(与 initialCapability 配合使用)。
  */
 initialParams?: Record<string, unknown>;
 /**
  * 布局模式:
  * - 'full': 完整三栏布局(默认)
  * - 'focused': 精简模式,隐藏 AssetPanel 和 PipelineBar,适合单工具页跳转进入
  */
 mode?: 'full' | 'focused';

 /** 是否显示左侧资产面板(默认 true;focused 模式下始终隐藏) */
 showAssetPanel?: boolean;
 /** 是否显示右侧 Inspector 面板(默认 true;关闭后整列不渲染) */
 showInspector?: boolean;
 /**
  * 替换中央画布(整体替换内置 Canvas)。
  * 传入时内置 Canvas(含预览 / 对比 / 拖拽导入)不渲染;
  * 三方需要完全自定义预览区时使用。渲染在 flex-1 容器内。
  */
 canvasSlot?: React.ReactNode;
 /**
  * 替换右侧 Inspector 内容(整体替换内置 Inspector)。
  * 传入时内置 Inspector(节点参数表单)不渲染,插件 Panel
  * (inspector 位置)仍会在其下方渲染。渲染在 flex-1 容器内。
  */
 inspectorSlot?: React.ReactNode;
 /**
  * 自定义画布空状态(无选中资产时),替换内置导入引导。
  * 透传给内置 Canvas 的 emptyState;canvasSlot 设置时本项无效。
  */
 canvasEmptyState?: React.ReactNode;

 className?: string;
}

/** W9.8 移动端抽屉切换状态 */
type MobilePanel = 'asset' | 'inspector' | null;

export function Workspace({
 title,
 locale,
 translations,
 showStatusBar = true,
 showHistoryPanel = true,
 enableGlobalDropzone = true,
 enableCommandPalette = true,
 enableThemeToggle = true,
 enableCompare = true,
 enableDownloadPanel = true,
 enableWorkflowEditor = false,
 enableProgressBar = true,
 enableErrorBanner = true,
 enableShareLink = true,
 initialAssets,
 initialCapability,
 initialParams,
 mode = 'full',
 showAssetPanel = true,
 showInspector = true,
 canvasSlot,
 inspectorSlot,
 canvasEmptyState,
 className = '',
 ...lokvisOptions
}: WorkspaceProps) {
 const outerCtx = useWorkspaceI18nContext();
 const lang = useWorkspaceLang(locale);
 const mergedTranslations = translations ?? outerCtx?.translations;
 const t = useWorkspaceTranslations(lang, mergedTranslations);
 const { status, error } = useLokvis(lokvisOptions);
 const { isMobile } = useBreakpoints();
 const [paletteOpen, setPaletteOpen] = useCommandPalette({ enabled: enableCommandPalette });
 // W9.8 移动端抽屉:Asset / Inspector 切换显示
 const [mobilePanel, setMobilePanel] = React.useState<MobilePanel>(null);

 // W11.5: 从 URL ?workflow= 参数加载分享工作流(runtime 就绪后执行一次)
 // 保护:若用户已通过其它路径(如 localStorage 恢复或手动添加)有 nodes,
 // 不静默替换 —— 用 ConfirmDialog 让用户显式选择,避免丢失未保存工作。
 // 注:不用 useWorkspaceStore 订阅 nodes.length 做 effect 依赖
 // (review 反馈:那样 nodesLength 变化会触发 effect 重跑,而 ref 已 true
 // 时重跑无意义,且语义上 effect 只应在 status 切换时跑一次)。
 // 改用 getState() 在体内读取最新值,既不订阅也不进 deps。
 const { loadFromCurrentUrl } = useShareLink();
 const shareLoadedRef = React.useRef(false);
 // 待确认的分享链接替换(nodes>0 时需用户确认才替换)
 const [shareConfirmOpen, setShareConfirmOpen] = React.useState(false);
 const [shareConfirmNodes, setShareConfirmNodes] = React.useState(0);
 React.useEffect(() => {
 if (enableShareLink && !shareLoadedRef.current && status !== 'initializing' && status !== 'error') {
 shareLoadedRef.current = true;
 // 仅在 URL 含 ?workflow= 参数时才提示(避免无谓弹窗)
 const hasShareParam = typeof window !== 'undefined'
 && new URLSearchParams(window.location.search).has('workflow');
 if (!hasShareParam) return;
 // 读取当前 nodes 长度(最新值,非订阅快照)
 const currentNodesLength = useWorkspaceStore.getState().nodes.length;
 if (currentNodesLength > 0) {
 setShareConfirmNodes(currentNodesLength);
 setShareConfirmOpen(true);
 return;
 }
 loadFromCurrentUrl();
 }
 }, [enableShareLink, status, loadFromCurrentUrl]);

 // 初始化 props:runtime 就绪后导入资产、添加节点、填充参数
 const initDoneRef = React.useRef(false);
 React.useEffect(() => {
  if (initDoneRef.current || status !== 'ready') return;
  const store = useWorkspaceStore.getState();
  if (!store.runtime) return;
  initDoneRef.current = true;

  (async () => {
   // 导入初始资产
   if (initialAssets?.length) {
    for (const { blob, name } of initialAssets) {
     const file = new File([blob], name, { type: blob.type });
     await store.runtime!.importAsset({ kind: 'file', file });
    }
    await store.refreshAssets();
    // 自动选中第一个资产
    const assets = store.assets;
    if (assets.length > 0) {
     store.selectAsset(assets[0]!.id);
    }
   }

   // 添加初始能力节点并填充参数
   if (initialCapability) {
    store.addNode(initialCapability);
    if (initialParams) {
     const nodes = useWorkspaceStore.getState().nodes;
     const lastNode = nodes[nodes.length - 1];
     if (lastNode) {
      store.updateNodeParams(lastNode.id, initialParams);
     }
    }
   }
  })();
  // initialAssets / initialCapability / initialParams 是一次性初始化输入(语义同
  // defaultValue):仅在 runtime 首次 ready 时消费一次,后续 prop 变化刻意忽略。
  // 因此依赖数组只保留 status,避免每次渲染新字面量触发的误导性重跑。
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [status]);

 const isFocused = mode === 'focused';

 // focused 模式无 AssetPanel:新导入资产的自动选中与缩略图由本 hook 接管
 // (full 模式下 hook 内部不执行任何逻辑)
 useFocusedAutoSelect(isFocused);

 if (status === 'initializing') {
 return (
 <div className="flex h-full items-center justify-center">
 <div className="flex flex-col items-center gap-4">
 <div className="relative flex h-12 w-12 items-center justify-center">
 <div className="absolute inset-0 rounded-full border-2 border-[var(--lokvis-primary)]/40" />
 <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-[var(--lokvis-primary)]" />
 </div>
 <div className="text-center">
 <p className="text-sm font-medium text-[var(--lokvis-fg-muted)]">{t('workspace.initializing')}</p>
 <p className="mt-1 text-xs text-[var(--lokvis-fg-subtle)]">{t('workspace.loadingPlugins')}</p>
 </div>
 </div>
 </div>
 );
 }

 if (status === 'error') {
 return (
 <div className="flex h-full items-center justify-center px-6">
 <div className="max-w-md rounded-xl border border-[var(--lokvis-danger)]/30 bg-[var(--lokvis-danger)]/10 p-6 text-center">
 <div className="mb-3 flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-[var(--lokvis-danger)]/15">
 <Icon size={20} className="text-[var(--lokvis-danger)]"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Icon>
 </div>
 <p className="font-semibold text-[var(--lokvis-danger)]">{t('workspace.initFailed')}</p>
 <p className="mt-1.5 text-sm text-[var(--lokvis-danger)]/80">{error}</p>
 </div>
 </div>
 );
 }

 // W9.7 Toolbar rightExtra: ThemeToggle + ⌘K hint
 const toolbarRight = (
 <>
 {enableCommandPalette && (
 <button
 type="button"
 onClick={() => setPaletteOpen(true)}
 aria-label={t('workspace.openPaletteAria')}
 title={t('workspace.paletteTitle')}
 className="flex h-7 items-center gap-1 rounded-md border border-[var(--lokvis-border)] px-1.5 text-[11px] text-[var(--lokvis-fg-muted)] transition-colors hover:bg-[var(--lokvis-surface-muted)] hover:text-[var(--lokvis-fg-muted)]"
 >
 <Icon size={11}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Icon>
 <kbd className="font-sans">⌘K</kbd>
 </button>
 )}
 {enableThemeToggle && <ThemeToggle />}
 {/* 插件 Panel(toolbar 位置) */}
 <PluginPanels location="toolbar" />
 {/* W9.8 移动端面板切换按钮 */}
 {isMobile && (
 <>
 {!isFocused && showAssetPanel && (
 <button
 type="button"
 onClick={() => setMobilePanel(mobilePanel === 'asset' ? null : 'asset')}
 aria-label={t('workspace.toggleAssets')}
 aria-pressed={mobilePanel === 'asset'}
 className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--lokvis-fg-muted)] hover:bg-[var(--lokvis-surface-muted)] hover:text-[var(--lokvis-fg-muted)]"
 >
 <Icon size={14}><rect x="3" y="3" width="7" height="18" rx="1" /><path d="M14 3h7v18h-7z" opacity="0.3" /></Icon>
 </button>
 )}
 {showInspector && (
 <button
 type="button"
 onClick={() => setMobilePanel(mobilePanel === 'inspector' ? null : 'inspector')}
 aria-label={t('workspace.toggleInspector')}
 aria-pressed={mobilePanel === 'inspector'}
 className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--lokvis-fg-muted)] hover:bg-[var(--lokvis-surface-muted)] hover:text-[var(--lokvis-fg-muted)]"
 >
 <Icon size={14}><path d="M3 3h7v18H3z" opacity="0.3" /><rect x="14" y="3" width="7" height="18" rx="1" /></Icon>
 </button>
 )}
 </>
 )}
 </>
 );

 return (
 // i18n Provider 包在最外层:子组件的 useWorkspaceLang() / ErrorBoundary 的
 // contextType 均能读到解析后的 locale 与翻译覆盖。
 // D6: ErrorBoundary 捕获子组件渲染异常,避免整个 workspace 白屏。
 // useLokvis 异常不在本组件树内(早于本 return),由消费方在外层包裹处理。
 <WorkspaceI18nProvider locale={lang} translations={mergedTranslations}>
 <ErrorBoundary>
 <div className={`flex h-full flex-col bg-[var(--lokvis-bg)] [font-family:var(--lokvis-font-sans)] ${className}`}>
 {/* Top: Toolbar */}
 <Toolbar title={title} rightExtra={toolbarRight} />

 {/* W11.3 ErrorBanner (有 error 时显示) */}
 {enableErrorBanner && <ErrorBanner />}

 {/* W9.3 全屏拖拽 */}
 {enableGlobalDropzone && <GlobalDropzone />}

 {/* W9.2 Command Palette */}
 {enableCommandPalette && (
 <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
 )}

 {/* Middle: Panel area(卡片式:面板间 gap + 内边距,卡片浮于 bg 之上) */}
 <div className="relative flex flex-1 gap-2 overflow-hidden p-2">
 {/* W9.8 桌面:三栏并列;移动:Canvas 单独,其他为 overlay drawer */}
 {!isFocused && showAssetPanel && (
 <div
 className={`${
 isMobile
 ? `absolute inset-y-0 left-0 z-20 w-64 max-w-[80vw] bg-[var(--lokvis-surface)] shadow-[var(--lokvis-elevation-overlay)] transition-transform duration-200 ${
 mobilePanel === 'asset' ? 'translate-x-0' : '-translate-x-full'
 }`
 : 'relative overflow-hidden rounded-[var(--lokvis-radius-lg)] border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] shadow-[var(--lokvis-elevation-1)]'
 } flex flex-col`}
 >
 <AssetPanel className="min-h-0 flex-1" />
 {/* 插件 Panel(sidebar 位置) */}
 <PluginPanels location="sidebar" />
 </div>
 )}

 {canvasSlot ? (
 <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--lokvis-radius-lg)] border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] shadow-[var(--lokvis-elevation-1)]">{canvasSlot}</div>
 ) : (
 <Canvas
 enableCompare={enableCompare}
 emptyState={canvasEmptyState}
 className="overflow-hidden rounded-[var(--lokvis-radius-lg)] border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] shadow-[var(--lokvis-elevation-1)]"
 />
 )}

 {showInspector && (
 <div
 className={`${
 isMobile
 ? `absolute inset-y-0 right-0 z-20 w-72 max-w-[80vw] bg-[var(--lokvis-surface)] shadow-[var(--lokvis-elevation-overlay)] transition-transform duration-200 ${
 mobilePanel === 'inspector' ? 'translate-x-0' : 'translate-x-full'
 }`
 : 'relative overflow-hidden rounded-[var(--lokvis-radius-lg)] border border-[var(--lokvis-border)] bg-[var(--lokvis-surface)] shadow-[var(--lokvis-elevation-1)]'
 } flex flex-col`}
 >
 {inspectorSlot ? (
 <div className="min-h-0 flex-1">{inspectorSlot}</div>
 ) : (
 <Inspector className="min-h-0 flex-1" />
 )}
 {/* 插件 Panel(inspector 位置) */}
 <PluginPanels location="inspector" />
 </div>
 )}

 {/* W9.8 移动端遮罩:点击关闭抽屉 */}
 {isMobile && mobilePanel !== null && !isFocused && (
 <button
 type="button"
 aria-label={t('workspace.closePanel')}
 onClick={() => setMobilePanel(null)}
 className="absolute inset-0 z-10 bg-[var(--lokvis-overlay)]"
 />
 )}
 </div>

 {/* Pipeline bar */}
 {!isFocused && (enableWorkflowEditor ? <WorkflowEditor /> : <PipelineBar />)}

 {/* W11.6 ProgressBar + Cancel */}
 {enableProgressBar && <ProgressBar />}

 {/* W9.1 History panel (horizontal at bottom) */}
 {showHistoryPanel && <HistoryPanel variant="horizontal" />}

 {/* W9.5 Download panel (条件渲染:有 outputs 时显示) */}
 {enableDownloadPanel && <DownloadPanel />}

 {/* Bottom: StatusBar */}
 {showStatusBar && <StatusBar />}

 {/* 插件 Panel(modal 位置:渲染器自行管理弹层展示) */}
 <PluginPanels location="modal" />

 {/* W11.5 分享链接替换确认(替代 window.confirm) */}
 <ConfirmDialog
 open={shareConfirmOpen}
 title={t('workspace.shareTitle')}
 message={t('workspace.shareMessage', { count: shareConfirmNodes })}
 confirmText={t('workspace.shareConfirm')}
 variant="danger"
 onConfirm={() => {
 setShareConfirmOpen(false);
 loadFromCurrentUrl();
 }}
 onClose={() => setShareConfirmOpen(false)}
 />
 </div>
 </ErrorBoundary>
 </WorkspaceI18nProvider>
 );
}
