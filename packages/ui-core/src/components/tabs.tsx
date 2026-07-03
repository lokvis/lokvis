import * as React from 'react';

export interface TabItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  /** 标签页定义 */
  items: TabItem[];
  /** 当前激活值(受控) */
  value?: string;
  /** 默认激活值(非受控) */
  defaultValue?: string;
  /** 激活值变更回调 */
  onChange?: (value: string) => void;
  /** 标签页内容渲染函数,按 value 分发 */
  children?: (activeValue: string) => React.ReactNode;
  className?: string;
}

/**
 * Tabs - 标签页。
 *
 * 受控 / 非受控双模式。键盘 ←/→ 切换,内容通过 render-prop children 渲染。
 *
 * @example
 * ```tsx
 * <Tabs
 *   items={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}
 *   defaultValue="a"
 * >
 *   {(active) => active === 'a' ? <PanelA /> : <PanelB />}
 * </Tabs>
 * ```
 */
export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  children,
  className = '',
}: TabsProps) {
  const firstEnabled = items.find((i) => !i.disabled)?.value ?? items[0]?.value ?? '';
  const [internal, setInternal] = React.useState(defaultValue ?? firstEnabled);
  const isControlled = value !== undefined;
  const active = isControlled ? value : internal;

  // 不用 useCallback:`items` 通常是渲染时内联的数组字面量,每次都是新引用,
  // 把它放进依赖数组会让 useCallback 每次重建——等于没 memo。
  // 组件本身很轻量,直接用普通函数,避免无意义的 memo 开销与误导。
  const select = (v: string) => {
    const item = items.find((i) => i.value === v);
    if (item?.disabled) return;
    if (!isControlled) setInternal(v);
    onChange?.(v);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = items.findIndex((i) => i.value === active);
    if (idx === -1) return;
    if (e.key === 'ArrowRight') {
      const next = items.slice(idx + 1).find((i) => !i.disabled);
      if (next) select(next.value);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      const prev = [...items.slice(0, idx)].reverse().find((i) => !i.disabled);
      if (prev) select(prev.value);
      e.preventDefault();
    } else if (e.key === 'Home') {
      // WAI-ARIA tabs pattern:Home 跳到首个可用 tab
      const first = items.find((i) => !i.disabled);
      if (first) select(first.value);
      e.preventDefault();
    } else if (e.key === 'End') {
      // End 跳到末个可用 tab
      const last = [...items].reverse().find((i) => !i.disabled);
      if (last) select(last.value);
      e.preventDefault();
    }
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800"
      >
        {items.map((item) => {
          const isActive = item.value === active;
          return (
            <button
              key={item.value}
              role="tab"
              type="button"
              aria-selected={isActive}
              disabled={item.disabled}
              onClick={() => select(item.value)}
              className={`relative -mb-px px-3 py-2 text-sm font-medium transition-colors focus:outline-none ${
                isActive
                  ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : item.disabled
                  ? 'cursor-not-allowed text-zinc-400'
                  : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
              style={isActive ? { borderColor: 'var(--lokvis-primary, #6366f1)' } : undefined}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {children && (
        <div role="tabpanel" className="pt-4">
          {children(active)}
        </div>
      )}
    </div>
  );
}
