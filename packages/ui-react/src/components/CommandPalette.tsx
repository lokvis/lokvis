/**
 * CommandPalette - ⌘K 工具选择器(W9.2)
 *
 * Command Palette 风格的快捷工具入口:
 * - ⌘K / Ctrl+K 打开
 * - ESC 关闭
 * - 输入关键词过滤能力列表
 * - ↑↓ 选择,Enter 添加到工作流,or 鼠标点击
 *
 * 数据源:`store.capabilities`,与 Inspector 右侧能力列表同源。
 * 选中后调用 `store.addNode(cap.name)` 添加到工作流,并关闭面板。
 *
 * 实现:基于 ui-core 的 Dialog 组件提供模态基底 + 焦点 trap。
 */

import * as React from 'react';
import { Dialog, Icon } from '@lokvis/ui-core';
import type { Capability } from '@lokvis/schema';
import { useWorkspaceStore } from '../store/index.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { pluralKey, useWorkspaceTranslations } from '../i18n/utils.js';

export interface CommandPaletteProps {
 /** 是否打开(受控) */
 open: boolean;
 /** 关闭回调 */
 onClose: () => void;
 className?: string;
}

export function CommandPalette({ open, onClose, className = '' }: CommandPaletteProps) {
 const capabilities = useWorkspaceStore((s) => s.capabilities);
 const addNode = useWorkspaceStore((s) => s.addNode);
 const undo = useWorkspaceStore((s) => s.undo);
 const redo = useWorkspaceStore((s) => s.redo);
 const clearWorkflow = useWorkspaceStore((s) => s.clearWorkflow);
 const running = useWorkspaceStore((s) => s.running);

 const lang = useWorkspaceLang();
 const t = useWorkspaceTranslations(lang);

 const [query, setQuery] = React.useState('');
 const [activeIndex, setActiveIndex] = React.useState(0);
 const inputRef = React.useRef<HTMLInputElement>(null);
 const listRef = React.useRef<HTMLUListElement>(null);

 // 命令项:capability 添加 + 工作流操作
 type Command =
 | { kind: 'capability'; cap: Capability }
 | { kind: 'action'; id: string; label: string; description: string; run: () => void; disabled?: boolean };

 const commands: Command[] = React.useMemo(() => {
 const caps = capabilities.map((cap) => ({ kind: 'capability' as const, cap }));
 const actions: Command[] = [
 {
 kind: 'action',
 id: 'undo',
 label: t('commandPalette.undo'),
 description: t('commandPalette.undoDesc'),
 run: () => void undo(),
 disabled: false,
 },
 {
 kind: 'action',
 id: 'redo',
 label: t('commandPalette.redo'),
 description: t('commandPalette.redoDesc'),
 run: () => void redo(),
 disabled: false,
 },
 {
 kind: 'action',
 id: 'clear',
 label: t('commandPalette.clearWorkflow'),
 description: t('commandPalette.clearWorkflowDesc'),
 run: () => clearWorkflow(),
 disabled: running,
 },
 ];
 return [...caps, ...actions];
 }, [capabilities, undo, redo, clearWorkflow, running, t]);

 const filtered = React.useMemo(() => {
 const q = query.trim().toLowerCase();
 if (!q) return commands;
 return commands.filter((cmd) => {
 if (cmd.kind === 'capability') {
 return (
 cmd.cap.name.toLowerCase().includes(q) ||
 cmd.cap.description.toLowerCase().includes(q) ||
 (cmd.cap.label?.toLowerCase().includes(q) ?? false)
 );
 }
 return cmd.label.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q);
 });
 }, [commands, query]);

 // 打开时重置 query + activeIndex + 聚焦输入
 React.useEffect(() => {
 if (!open) return;
 setQuery('');
 setActiveIndex(0);
 // Dialog 聚焦首个可聚焦元素(input)后,input ref 才有值
 // 用 timer 句柄 + cleanup 避免卸载后 setState 警告
 const t = setTimeout(() => inputRef.current?.focus(), 0);
 return () => clearTimeout(t);
 }, [open]);

 // filtered 变化时校正 activeIndex 越界
 React.useEffect(() => {
 if (activeIndex >= filtered.length) {
 setActiveIndex(filtered.length === 0 ? 0 : filtered.length - 1);
 }
 }, [filtered.length, activeIndex]);

 // 滚动 active 项进入视区
 React.useEffect(() => {
 if (!open || !listRef.current) return;
 const active = listRef.current.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
 active?.scrollIntoView({ block: 'nearest' });
 }, [activeIndex, open]);

 function handleSelect(cmd: Command) {
 if (cmd.kind === 'capability') {
 addNode(cmd.cap.name);
 } else {
 if (cmd.disabled) return;
 cmd.run();
 }
 onClose();
 }

 function handleKeyDown(e: React.KeyboardEvent) {
 if (e.key === 'ArrowDown') {
 e.preventDefault();
 setActiveIndex((i) => (i + 1) % Math.max(1, filtered.length));
 } else if (e.key === 'ArrowUp') {
 e.preventDefault();
 setActiveIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length));
 } else if (e.key === 'Enter') {
 e.preventDefault();
 const cmd = filtered[activeIndex];
 if (cmd) handleSelect(cmd);
 }
 }

 return (
 <Dialog open={open} onClose={onClose} size="md" closeOnOverlay>
 <div className={`-mx-5 -my-5 ${className}`}>
 {/* 搜索输入 */}
 <div className="flex items-center gap-2 border-b border-[var(--lokvis-border)] px-4 py-3">
 <Icon size={16} className="text-[var(--lokvis-fg-subtle)]">
 <circle cx="11" cy="11" r="8" />
 <path d="m21 21-4.3-4.3" />
 </Icon>
 <input
 ref={inputRef}
 type="text"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder={t('commandPalette.searchPlaceholder')}
 aria-label={t('commandPalette.searchAria')}
 className="flex-1 bg-transparent text-sm text-[var(--lokvis-fg)] placeholder:text-[var(--lokvis-fg-subtle)] focus:outline-none"
 autoComplete="off"
 spellCheck={false}
 />
 <kbd className="rounded border border-[var(--lokvis-border)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--lokvis-fg-subtle)]">
 ESC
 </kbd>
 </div>

 {/* 命令列表 */}
 <ul
 ref={listRef}
 className="max-h-80 overflow-y-auto py-1"
 role="listbox"
 aria-label={t('commandPalette.commandsAria')}
 >
 {filtered.length === 0 ? (
 <li className="px-4 py-6 text-center text-xs text-[var(--lokvis-fg-subtle)]">
 {t('commandPalette.noMatch')}
 </li>
 ) : (
 filtered.map((cmd, i) => {
 const isActive = i === activeIndex;
 const isCap = cmd.kind === 'capability';
 const primary = isCap ? (cmd.cap.label ?? cmd.cap.name) : cmd.label;
 const secondary = isCap ? cmd.cap.description : cmd.description;
 const disabled = !isCap && cmd.disabled;
 return (
 <li
 key={isCap ? `cap:${cmd.cap.name}` : `act:${cmd.id}`}
 data-index={i}
 role="option"
 aria-selected={isActive}
 aria-disabled={disabled}
 >
 <button
 type="button"
 onMouseEnter={() => setActiveIndex(i)}
 onClick={() => !disabled && handleSelect(cmd)}
 disabled={disabled}
 className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
 isActive && !disabled
 ? 'bg-[var(--lokvis-primary)]/10'
 : ''
 } ${disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-[var(--lokvis-surface)]'}`}
 >
 <span
 className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${
 isCap
 ? 'bg-[var(--lokvis-surface-muted)] text-[var(--lokvis-fg-muted)]'
 : 'bg-[var(--lokvis-primary)]/15 text-[var(--lokvis-primary)]'
 }`}
 >
 {isCap && cmd.cap.icon ? (
 <span aria-hidden="true" className="text-xs">{cmd.cap.icon}</span>
 ) : (
 <Icon size={12} strokeWidth={2}>
 {isCap ? (
 <path d="M12 4.5v15m7.5-7.5h-15" />
 ) : (
 <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
 )}
 </Icon>
 )}
 </span>
 <div className="min-w-0 flex-1">
 <div className="flex items-center justify-between gap-2">
 <span className="truncate text-xs font-medium text-[var(--lokvis-fg)]">
 {primary}
 </span>
 {isCap && (
 <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase bg-[var(--lokvis-surface-muted)] text-[var(--lokvis-fg-muted)]">
 {cmd.cap.performance}
 </span>
 )}
 </div>
 <p className="truncate text-[10px] text-[var(--lokvis-fg-muted)]">
 {secondary}
 </p>
 </div>
 </button>
 </li>
 );
 })
 )}
 </ul>

 {/* 底部提示 */}
 <div className="flex items-center justify-between border-t border-[var(--lokvis-border)] px-4 py-2 text-[10px] text-[var(--lokvis-fg-subtle)]">
 <span className="flex items-center gap-1">
 <kbd className="rounded border border-[var(--lokvis-border)] px-1">↑↓</kbd>
 <span>{t('commandPalette.navigate')}</span>
 <kbd className="ml-2 rounded border border-[var(--lokvis-border)] px-1">↵</kbd>
 <span>{t('commandPalette.select')}</span>
 </span>
 <span>
 {t(pluralKey(lang, 'commandPalette.commandCount', filtered.length), { count: filtered.length })}
 </span>
 </div>
 </div>
 </Dialog>
 );
}

/**
 * useCommandPalette - 在组件中注册 ⌘K / Ctrl+K 全局快捷键打开面板。
 *
 * 返回 [open, setOpen]。在 useEffect 中绑定 keydown 监听。
 * 兼容 macOS(⌘K)与 Windows/Linux(Ctrl+K)。Shift+⌘K / Ctrl+Shift+K 也触发,
 * 方便用户在 ⌘K 被浏览器拦截时使用。
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useCommandPalette();
 * // 或禁用快捷键(仍可受控使用 open/setOpen):
 * const [open, setOpen] = useCommandPalette({ enabled: false });
 * return (
 * <>
 * <CommandPalette open={open} onClose={() => setOpen(false)} />
 * </>
 * );
 * ```
 */
export interface UseCommandPaletteOptions {
 /** 是否注册 ⌘K 全局快捷键(默认 true)。设为 false 时仍可受控使用 open/setOpen */
 enabled?: boolean;
}

export function useCommandPalette(
 options: UseCommandPaletteOptions = {}
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
 const { enabled = true } = options;
 const [open, setOpen] = React.useState(false);

 React.useEffect(() => {
 if (!enabled) return;
 const onKey = (e: KeyboardEvent) => {
 // ⌘K (mac) / Ctrl+K (win/linux),忽略纯 K(避免拦截输入)
 if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
 e.preventDefault();
 setOpen((v) => !v);
 }
 };
 document.addEventListener('keydown', onKey);
 return () => document.removeEventListener('keydown', onKey);
 }, [enabled]);

 return [open, setOpen];
}
