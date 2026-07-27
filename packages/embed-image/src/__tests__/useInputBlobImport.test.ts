// @vitest-environment jsdom
/**
 * useInputBlobImport 单元测试(inputBlob 选项实现)。
 *
 * 覆盖:
 * - ready 时注入 Blob 走 handleFiles(包装为 File,MIME 透传)
 * - File 实例直接透传(保留文件名)
 * - 同一 Blob 实例不重复导入(引用去重)
 * - 新 Blob 实例重新导入
 * - null / undefined 不导入
 * - runtime 未就绪时延迟到 ready 后导入
 *
 * useImageTool 以最小 fake 对象替代(本 hook 只依赖 ready + handleFiles)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInputBlobImport } from '../internal/useInputBlobImport';
import type { UseImageToolResult } from '../internal/useImageTool';

function makeTool(overrides: Partial<UseImageToolResult> = {}): UseImageToolResult {
  return {
    runtime: null,
    ready: true,
    initError: null,
    inputId: null,
    inputUrl: null,
    inputInfo: null,
    outputBlob: null,
    outputUrl: null,
    outputInfo: null,
    busy: false,
    error: null,
    handleFiles: vi.fn(async () => ({ skipped: 0 })),
    runWorkflow: vi.fn(async () => {}),
    runWorkflowRaw: vi.fn(async () => null),
    commitOutput: vi.fn(async () => {}),
    reset: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

describe('useInputBlobImport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ready 时注入 Blob 经 handleFiles 导入,包装为 File 且 MIME 透传', () => {
    const tool = makeTool();
    const blob = new Blob(['img'], { type: 'image/webp' });
    renderHook(() => useInputBlobImport(tool, blob));
    expect(tool.handleFiles).toHaveBeenCalledTimes(1);
    const file = (tool.handleFiles as ReturnType<typeof vi.fn>).mock.calls[0]![0]![0];
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/webp');
  });

  it('无 MIME 的 Blob 兜底为 image/png', () => {
    const tool = makeTool();
    const blob = new Blob(['img']);
    renderHook(() => useInputBlobImport(tool, blob));
    const file = (tool.handleFiles as ReturnType<typeof vi.fn>).mock.calls[0]![0]![0];
    expect(file.type).toBe('image/png');
  });

  it('File 实例直接透传,保留文件名', () => {
    const tool = makeTool();
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    renderHook(() => useInputBlobImport(tool, file));
    expect(tool.handleFiles).toHaveBeenCalledWith([file]);
  });

  it('同一 Blob 实例重复渲染不重复导入', () => {
    const tool = makeTool();
    const blob = new Blob(['img'], { type: 'image/png' });
    const { rerender } = renderHook(() => useInputBlobImport(tool, blob));
    rerender();
    rerender();
    expect(tool.handleFiles).toHaveBeenCalledTimes(1);
  });

  it('替换为新 Blob 实例时重新导入', () => {
    const tool = makeTool();
    const first = new Blob(['a'], { type: 'image/png' });
    const second = new Blob(['b'], { type: 'image/png' });
    const { rerender } = renderHook(
      ({ blob }: { blob: Blob }) => useInputBlobImport(tool, blob),
      { initialProps: { blob: first } }
    );
    rerender({ blob: second });
    expect(tool.handleFiles).toHaveBeenCalledTimes(2);
  });

  it('null / undefined 不触发导入', () => {
    const tool = makeTool();
    const { rerender } = renderHook(
      ({ blob }: { blob: Blob | null }) => useInputBlobImport(tool, blob),
      { initialProps: { blob: null } }
    );
    rerender({ blob: null });
    expect(tool.handleFiles).not.toHaveBeenCalled();
  });

  it('runtime 未就绪时不导入,ready 后自动补导入', () => {
    const tool = makeTool({ ready: false });
    const blob = new Blob(['img'], { type: 'image/png' });
    const { rerender } = renderHook(() => useInputBlobImport(tool, blob));
    expect(tool.handleFiles).not.toHaveBeenCalled();

    // runtime 就绪(同一 blob 实例)
    tool.ready = true;
    rerender();
    expect(tool.handleFiles).toHaveBeenCalledTimes(1);
  });
});
