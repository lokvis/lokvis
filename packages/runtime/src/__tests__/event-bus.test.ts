/**
 * EventBus 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEventBus } from '../event-bus.js';
import type { LokvisEvent } from '@lokvis/schema';

describe('createEventBus', () => {
  let bus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    bus = createEventBus();
  });

  it('on() 订阅后应收到对应类型事件', () => {
    const handler = vi.fn();
    bus.on('asset:imported', handler);

    const event: LokvisEvent = {
      type: 'asset:imported',
      assetId: 'a1',
      metadata: { mimeType: 'image/png', size: 100, format: 'png' },
    };
    bus.emit(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('on() 返回的取消订阅函数应能移除订阅', () => {
    const handler = vi.fn();
    const off = bus.on('asset:removed', handler);

    off();
    bus.emit({ type: 'asset:removed', assetId: 'a1' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('不同事件类型不应互相干扰', () => {
    const importedHandler = vi.fn();
    const removedHandler = vi.fn();
    bus.on('asset:imported', importedHandler);
    bus.on('asset:removed', removedHandler);

    bus.emit({
      type: 'asset:imported',
      assetId: 'a1',
      metadata: { mimeType: 'image/png', size: 1, format: 'png' },
    });

    expect(importedHandler).toHaveBeenCalledTimes(1);
    expect(removedHandler).not.toHaveBeenCalled();
  });

  it('onAny() 应收到所有事件', () => {
    const anyHandler = vi.fn();
    bus.onAny(anyHandler);

    bus.emit({ type: 'asset:removed', assetId: 'a1' });
    bus.emit({
      type: 'plugin:loaded',
      name: 'p',
      version: '1.0.0',
    });

    expect(anyHandler).toHaveBeenCalledTimes(2);
    expect(anyHandler.mock.calls[0]![0].type).toBe('asset:removed');
    expect(anyHandler.mock.calls[1]![0].type).toBe('plugin:loaded');
  });

  it('onAny() 返回的取消订阅函数应生效', () => {
    const handler = vi.fn();
    const off = bus.onAny(handler);
    off();

    bus.emit({ type: 'asset:removed', assetId: 'a1' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('clear() 应清除所有订阅', () => {
    const handler = vi.fn();
    const anyHandler = vi.fn();
    bus.on('asset:imported', handler);
    bus.onAny(anyHandler);

    bus.clear();
    bus.emit({
      type: 'asset:imported',
      assetId: 'a1',
      metadata: { mimeType: 'image/png', size: 1, format: 'png' },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(anyHandler).not.toHaveBeenCalled();
  });

  it('同一事件多个订阅者都应被触发', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('asset:imported', h1);
    bus.on('asset:imported', h2);

    bus.emit({
      type: 'asset:imported',
      assetId: 'a1',
      metadata: { mimeType: 'image/png', size: 1, format: 'png' },
    });

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('emit 事件后对应类型订阅仍保留（可重复触发）', () => {
    const handler = vi.fn();
    bus.on('asset:removed', handler);

    bus.emit({ type: 'asset:removed', assetId: 'a1' });
    bus.emit({ type: 'asset:removed', assetId: 'a2' });

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
