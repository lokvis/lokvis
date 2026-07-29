/**
 * 事件订阅工具(TD-6.2 长期方案)
 *
 * 提供 reuseSubscription:重入安全订阅,新订阅自动清理上一个(TD-6.2)。
 *
 * 注:此前的 subscribeAll(多事件一次性订阅)已随工作流执行编排下沉到
 * @lokvis/sdk 的 runWithProgress 而移除,store 不再手写节点事件订阅。
 */

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
