/**
 * Lokvis Event Bus Implementation
 *
 * 基于 mitt 的轻量事件总线实现。
 * 所有操作发出标准事件，Analytics/Undo/AI/Plugin 都监听事件。
 */

import mitt from 'mitt';
import type { EventBus, LokvisEvent } from '@lokvis/schema';

type Events = Record<string, unknown>;

export function createEventBus(): EventBus {
  const emitter = mitt<Events>();
  const anyHandlers = new Set<(event: LokvisEvent) => void>();

  return {
    on(type, handler) {
      const wrapped = (e: unknown) => handler(e as never);
      emitter.on(type, wrapped);
      return () => emitter.off(type, wrapped);
    },

    onAny(handler) {
      anyHandlers.add(handler);
      return () => anyHandlers.delete(handler);
    },

    emit(event) {
      emitter.emit(event.type, event);
      for (const handler of anyHandlers) {
        handler(event);
      }
    },

    clear() {
      emitter.all.clear();
      anyHandlers.clear();
    },
  };
}
