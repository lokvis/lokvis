/**
 * worker-errors 单元测试
 *
 * 覆盖 6 个 Worker 错误类的构造(message / name / 附加字段)。
 * 这些错误类是 @lokvis/sdk 通过 instanceof 消费的稳定契约。
 */
import { describe, it, expect } from 'vitest';
import {
  WorkerCrashedError,
  WorkerRestartingError,
  WorkerDeadError,
  WorkerRequestTimeoutError,
  WorkerHandshakeError,
  WorkerRequestAbortedError,
} from '../worker-errors.js';

describe('worker-errors', () => {
  it('WorkerCrashedError 携带 reason / restartCount', () => {
    const e = new WorkerCrashedError('boom', 2);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('WorkerCrashedError');
    expect(e.message).toContain('boom');
    expect(e.reason).toBe('boom');
    expect(e.restartCount).toBe(2);
  });

  it('WorkerRestartingError 具备固定 message', () => {
    const e = new WorkerRestartingError();
    expect(e.name).toBe('WorkerRestartingError');
    expect(e.message).toMatch(/restarting/i);
  });

  it('WorkerDeadError 携带 restartCount', () => {
    const e = new WorkerDeadError(3);
    expect(e.name).toBe('WorkerDeadError');
    expect(e.restartCount).toBe(3);
    expect(e.message).toContain('3');
  });

  it('WorkerRequestTimeoutError 携带 method 与超时信息', () => {
    const e = new WorkerRequestTimeoutError('image.resize', 5000);
    expect(e.name).toBe('WorkerRequestTimeoutError');
    expect(e.method).toBe('image.resize');
    expect(e.message).toContain('image.resize');
    expect(e.message).toContain('5000');
  });

  it('WorkerHandshakeError 透传 message', () => {
    const e = new WorkerHandshakeError('protocol mismatch');
    expect(e.name).toBe('WorkerHandshakeError');
    expect(e.message).toBe('protocol mismatch');
  });

  it('WorkerRequestAbortedError 携带 method', () => {
    const e = new WorkerRequestAbortedError('image.compress');
    expect(e.name).toBe('WorkerRequestAbortedError');
    expect(e.method).toBe('image.compress');
    expect(e.message).toContain('image.compress');
  });
});
