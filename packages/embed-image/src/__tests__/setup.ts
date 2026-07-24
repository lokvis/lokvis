/**
 * vitest setup:embed-image 包测试共用环境初始化。
 *
 * jsdom 不实现 window.matchMedia,F1 的 useEmbedMode(mode='system') 需要它。
 * 这里统一 mock,避免每个 Layer 2 测试文件重复。
 */
import { vi } from 'vitest';

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
