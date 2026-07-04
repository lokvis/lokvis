/**
 * useMediaQuery - 响应式断点 hook(W9.8)
 *
 * 在 React 中订阅 `matchMedia` 查询,断点变化时触发组件重渲染。
 * SSR 安全:`window` 不存在时返回初始值 `false`。
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
 * ```
 *
 * 内置断点常量(与 Tailwind v4 默认对齐):
 *   - sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px
 */

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    // 初始同步(matchMedia 可能在 effect 跑前已变化)
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** W9.8 三档断点 helper */
export interface Breakpoints {
  /** 移动端 (< 768px) */
  isMobile: boolean;
  /** 平板 (768px - 1023px) */
  isTablet: boolean;
  /** 桌面 (>= 1024px) */
  isDesktop: boolean;
}

export function useBreakpoints(): Breakpoints {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  return { isMobile, isTablet, isDesktop };
}
