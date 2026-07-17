/**
 * 事件订阅工具(TD-6.1 / TD-6.2 长期方案)
 *
 * 提供两个工具消除 ui-react store 内事件订阅 cleanup 的样板代码:
 * - subscribeAll:多事件一次性订阅 + 统一卸载(TD-6.1)
 * - reuseSubscription:重入安全订阅,新订阅自动清理上一个(TD-6.2)
 */
import type { EventBus, LokvisEvent, LokvisEventType } from '@lokvis/schema';

/**
 * 多事件一次性订阅,返回统一卸载函数。
 *
 * 替代手写多个 eventBus.on(...) + finally 内逐个 off() 的样板。
 * 每个卸载用 try/catch 隔离,单个 off 异常不阻断后续卸载。
 *
 * @example
 * const offAll = subscribeAll(runtime.eventBus, {
 *   'node:started': (e) => get().setNodeStatus(e.nodeId, 'running'),
 *   'node:finished': (e) => get().setNodeStatus(e.nodeId, 'success', undefined, e.duration),
 *   'node:failed': (e) => get().setNodeStatus(e.nodeId, 'failed', errMsg(e.error)),
 * });
 * try { await runtime.run(workflow, [input]); }
 * finally { offAll(); }
 */
export function subscribeAll<T extends LokvisEventType>(
  eventBus: EventBus,
  handlers: { [K in T]: (event: Extract<LokvisEvent, { type: K }>) => void }
): () => void {
  const offs = (Object.keys(handlers) as T[]).map((type) =>
    eventBus.on(type, handlers[type])
  );
  return () => {
    for (const off of offs) {
      try {
        off();
      } catch {
        // 单个 off 异常不阻断后续卸载(与 EventBus.emit 的 handler 隔离策略一致)
      }
    }
  };
}

/**
 * 重入安全订阅工厂。
 *
 * 用于"重复调用 init 时需先清理上一次订阅"的场景(TD-6.2)。
 * 持有当前订阅的卸载函数,subscribe() 会先清理上一个再建立新的,dispose() 清理当前。
 *
 * @example
 * const historySub = reuseSubscription(() => runtime.eventBus.on('history:changed', handler));
 * historySub.subscribe();  // 建立订阅
 * historySub.subscribe();  // 自动清理上一个,再建立新的
 * historySub.dispose();    // 清理当前订阅
 */
export function reuseSubscription(
  factory: () => () => void
): { subscribe: () => void; dispose: () => void } {
  let off: (() => void) | null = null;
  return {
    subscribe() {
      if (off) {
        try {
          off();
        } catch {
          // 旧订阅卸载异常不阻断新订阅建立
        }
        off = null;
      }
      off = factory();
    },
    dispose() {
      if (off) {
        try {
          off();
        } catch {
          // 卸载异常不阻断调用方后续逻辑
        }
        off = null;
      }
    },
  };
}
