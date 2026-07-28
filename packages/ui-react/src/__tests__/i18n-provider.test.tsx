// @vitest-environment jsdom
/**
 * WorkspaceI18nProvider + useWorkspaceLang + 组件 locale 渲染测试
 *
 * 覆盖:
 * - useWorkspaceLang 优先级链: 显式 locale prop > Provider > html lang > URL 前缀
 * - popstate 导航后语言更新
 * - useWorkspaceTranslations 的 Provider translations 覆盖注入
 * - StatusBar 组件在 zh locale 下渲染中文文案(含 store 侧 I18nMessage 翻译)
 * - 无 locale 时默认英文(向后兼容)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { WorkspaceI18nProvider } from '../i18n/WorkspaceI18nProvider.js';
import { useWorkspaceLang } from '../i18n/useWorkspaceLang.js';
import { useWorkspaceTranslations } from '../i18n/utils.js';
import { StatusBar } from '../components/StatusBar.js';
import { useWorkspaceStore } from '../store/index.js';

function zhWrapper({ children }: { children: ReactNode }) {
  return <WorkspaceI18nProvider locale="zh">{children}</WorkspaceI18nProvider>;
}

beforeEach(() => {
  document.documentElement.lang = '';
  window.history.pushState(null, '', '/');
  useWorkspaceStore.setState({
    statusMessage: { key: 'status.imported', params: { count: 2 } },
    error: null,
    running: false,
    assets: [],
    capabilities: [],
    nodes: [],
    selectedNodeId: null,
    storageUsage: null,
  });
});

afterEach(() => {
  cleanup();
  document.documentElement.lang = '';
  window.history.pushState(null, '', '/');
});

describe('useWorkspaceLang 优先级链', () => {
  it('默认(无 Provider / html lang / URL 前缀)返回 en', () => {
    const { result } = renderHook(() => useWorkspaceLang());
    expect(result.current).toBe('en');
  });

  it('检测 document.documentElement.lang', () => {
    document.documentElement.lang = 'ja';
    const { result } = renderHook(() => useWorkspaceLang());
    expect(result.current).toBe('ja');
  });

  it('html lang 带地区子标签(zh-CN / EN-us)时按主子标签匹配', () => {
    document.documentElement.lang = 'zh-CN';
    const { result } = renderHook(() => useWorkspaceLang());
    expect(result.current).toBe('zh');

    document.documentElement.lang = 'EN-us';
    const { result: result2 } = renderHook(() => useWorkspaceLang());
    expect(result2.current).toBe('en');
  });

  it('html lang 非支持语言时回退 URL 前缀', () => {
    document.documentElement.lang = 'ko';
    window.history.pushState(null, '', '/de/tools');
    const { result } = renderHook(() => useWorkspaceLang());
    expect(result.current).toBe('de');
  });

  it('Provider locale 优先于 html lang', () => {
    document.documentElement.lang = 'ja';
    const { result } = renderHook(() => useWorkspaceLang(), { wrapper: zhWrapper });
    expect(result.current).toBe('zh');
  });

  it('显式 locale 参数优先级最高', () => {
    document.documentElement.lang = 'ja';
    const { result } = renderHook(() => useWorkspaceLang('fr'), { wrapper: zhWrapper });
    expect(result.current).toBe('fr');
  });

  it('popstate 导航后语言更新', () => {
    const { result } = renderHook(() => useWorkspaceLang());
    expect(result.current).toBe('en');
    act(() => {
      window.history.pushState(null, '', '/es/editor');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toBe('es');
  });
});

describe('useWorkspaceTranslations 覆盖注入', () => {
  it('Provider translations 覆盖包内字典', () => {
    const { result } = renderHook(
      () => {
        const lang = useWorkspaceLang();
        return useWorkspaceTranslations(lang);
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <WorkspaceI18nProvider
            locale="zh"
            translations={{ 'statusBar.dismiss': { zh: '忽略' } }}
          >
            {children}
          </WorkspaceI18nProvider>
        ),
      }
    );
    expect(result.current('statusBar.dismiss')).toBe('忽略');
    // 未覆盖的 key 回退包内字典
    expect(result.current('statusBar.online')).toBe('在线');
  });

  it('显式 overrides 参数优先于 Provider translations', () => {
    const { result } = renderHook(
      () => useWorkspaceTranslations('zh', { 'statusBar.dismiss': { zh: '关掉' } }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <WorkspaceI18nProvider
            locale="zh"
            translations={{ 'statusBar.dismiss': { zh: '忽略' } }}
          >
            {children}
          </WorkspaceI18nProvider>
        ),
      }
    );
    expect(result.current('statusBar.dismiss')).toBe('关掉');
  });
});

describe('StatusBar 组件 locale 渲染', () => {
  it('zh locale 下渲染中文文案(含 store I18nMessage 翻译)', () => {
    render(
      <WorkspaceI18nProvider locale="zh">
        <StatusBar />
      </WorkspaceI18nProvider>
    );
    expect(screen.getByText('已导入 2 个文件')).toBeTruthy();
    expect(screen.getByText('在线')).toBeTruthy();
    expect(screen.getByText('0 个资产')).toBeTruthy();
  });

  it('无 locale 时默认英文(向后兼容)', () => {
    render(<StatusBar />);
    expect(screen.getByText('Imported 2 file(s)')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('0 assets')).toBeTruthy();
  });

  it('store error 为原始字符串时原样展示,dismiss 按钮为当前语言', () => {
    useWorkspaceStore.setState({ error: 'Engine crashed: OOM' });
    render(
      <WorkspaceI18nProvider locale="zh">
        <StatusBar />
      </WorkspaceI18nProvider>
    );
    expect(screen.getByText('关闭')).toBeTruthy();
  });
});
