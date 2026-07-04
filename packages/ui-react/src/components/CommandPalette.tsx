/**
 * CommandPalette - ⌘K 工具选择器(W9.2)
 *
 * Command Palette 风格的快捷工具入口:
 *   - ⌘K / Ctrl+K 打开
 *   - ESC 关闭
 *   - 输入关键词过滤能力列表
 *   - ↑↓ 选择,Enter 添加到工作流,or 鼠标点击
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
        label: 'Undo',
        description: '回退到上一步历史',
        run: () => void undo(),
        disabled: false,
      },
      {
        kind: 'action',
        id: 'redo',
        label: 'Redo',
        description: '重做一步',
        run: () => void redo(),
        disabled: false,
      },
      {
        kind: 'action',
        id: 'clear',
        label: 'Clear Workflow',
        description: '清空当前工作流节点',
        run: () => clearWorkflow(),
        disabled: running,
      },
    ];
    return [...caps, ...actions];
  }, [capabilities, undo, redo, clearWorkflow, running]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((cmd) => {
      if (cmd.kind === 'capability') {
        return (
          cmd.cap.name.toLowerCase().includes(q) ||
          cmd.cap.description.toLowerCase().includes(q)
        );
      }
      return cmd.label.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q);
    });
  }, [commands, query]);

  // 打开时重置 query + activeIndex + 聚焦输入
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Dialog 聚焦首个可聚焦元素(input)后,input ref 才有值
      setTimeout(() => inputRef.current?.focus(), 0);
    }
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
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <Icon size={16} className="text-zinc-400">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </Icon>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands or capabilities..."
            aria-label="Search commands"
            className="flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded border border-zinc-200 px-1.5 py-0.5 text-[9px] font-medium text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
            ESC
          </kbd>
        </div>

        {/* 命令列表 */}
        <ul
          ref={listRef}
          className="max-h-80 overflow-y-auto py-1"
          role="listbox"
          aria-label="Available commands"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-zinc-400">
              No matching commands
            </li>
          ) : (
            filtered.map((cmd, i) => {
              const isActive = i === activeIndex;
              const isCap = cmd.kind === 'capability';
              const primary = isCap ? cmd.cap.name : cmd.label;
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
                        ? 'bg-indigo-50 dark:bg-indigo-950/30'
                        : ''
                    } ${disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${
                        isCap
                          ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                          : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400'
                      }`}
                    >
                      <Icon size={12} strokeWidth={2}>
                        {isCap ? (
                          <path d="M12 4.5v15m7.5-7.5h-15" />
                        ) : (
                          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
                        )}
                      </Icon>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {primary}
                        </span>
                        {isCap && (
                          <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {cmd.cap.performance}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
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
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 text-[10px] text-zinc-400 dark:border-zinc-800">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-200 px-1 dark:border-zinc-700">↑↓</kbd>
            <span>navigate</span>
            <kbd className="ml-2 rounded border border-zinc-200 px-1 dark:border-zinc-700">↵</kbd>
            <span>select</span>
          </span>
          <span>{filtered.length} command{filtered.length !== 1 ? 's' : ''}</span>
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
 * return (
 *   <>
 *     <CommandPalette open={open} onClose={() => setOpen(false)} />
 *   </>
 * );
 * ```
 */
export function useCommandPalette(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K (mac) / Ctrl+K (win/linux),忽略纯 K(避免拦截输入)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return [open, setOpen];
}
