import { describe, it, expect, vi } from 'vitest';
import { createCaptureException } from '../sentry.js';

describe('createCaptureException', () => {
  it('应返回函数', () => {
    expect(typeof createCaptureException('test')).toBe('function');
  });

  it('调用时应以 label 为前缀输出 console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const capture = createCaptureException('embed-pdf');
    const err = new Error('test error');
    capture(err, { step: 1 });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]![0]).toBe('[embed-pdf] captured exception:');
    expect(spy.mock.calls[0]![1]).toBe(err);
    expect(spy.mock.calls[0]![2]).toEqual({ step: 1 });
    spy.mockRestore();
  });

  it('无 context 参数时仍正常工作', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const capture = createCaptureException('embed-image');
    capture('string error');

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]![0]).toBe('[embed-image] captured exception:');
    expect(spy.mock.calls[0]![1]).toBe('string error');
    spy.mockRestore();
  });
});
