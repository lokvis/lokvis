/**
 * History Manager(W1.3 从 runtime.ts 抽取)
 *
 * 持有每个工作流的 HistoryStack + initialInputs / currentOutputs 映射,
 * 提供 history / undo / redo / jumpTo,监听 node:finished 自动 append,
 * LRU 上限清理,持久化快照到 historyStore(IDB)支持跨会话恢复。
 * deps 注入 eventBus / assetStore / historyStore?,不持有 Runtime 实例避免
 * 循环依赖。prepareForRun / recordRunResult 供 WorkflowCoordinator 调用。
 */

import type {
  AssetId,
  EventBus,
  HistoryEntry,
  LokvisEvent,
} from '@lokvis/schema';
import { generateId } from '../asset-store.js';
import { HistoryStack, type HistoryStackConfig } from '../history.js';
import type { HistoryStore } from '../history-store.js';
import type { QuotaAwareAssetStore } from './quota-manager.js';

const DEFAULT_MAX_HISTORY = 10;

/** 同时持有的工作流历史栈上限(W2.8);超限按 FIFO 清理最旧 stack。 */
const MAX_CONCURRENT_WORKFLOW_STACKS = 32;

export interface HistoryManagerDeps {
  eventBus: EventBus;
  assetStore: QuotaAwareAssetStore;
  /** undefined 时退化为仅内存历史(刷新后丢失) */
  historyStore?: HistoryStore;
}

/** 历史栈管理封装,由 RuntimeImpl 持有并委托 */
export class HistoryManager {
  private historyStacks = new Map<string, HistoryStack>();
  private initialInputsMap = new Map<string, AssetId[]>();
  private currentOutputsMap = new Map<string, AssetId[]>();
  /** 加载快照期间守卫:restore() 触发 onChanged → persistHistory 时跳过冗余写回 */
  private isLoadingHistory = false;
  /**
   * 加载期间被跳过的 persistHistory 加入此 Set,loadPersistedHistory 结束后
   * 逐个补 persist,避免加载期间变更被永久丢弃(W7.2 review 修复)。
   */
  private dirtyDuringLoad = new Set<string>();

  constructor(private readonly deps: HistoryManagerDeps) {
    this.deps.eventBus.on('node:finished', (event) => {
      this.recordFromNodeEvent(
        event as Extract<LokvisEvent, { type: 'node:finished' }>
      );
    });
  }

  async history(workflowId: string): Promise<HistoryEntry[]> {
    return this.historyStacks.get(workflowId)?.list() ?? [];
  }

  async getHistoryState(
    workflowId: string
  ): Promise<{ entries: HistoryEntry[]; cursor: number }> {
    const stack = this.historyStacks.get(workflowId);
    if (!stack) return { entries: [], cursor: -1 };
    const snap = stack.snapshot();
    return { entries: snap.entries, cursor: snap.cursor };
  }

  /** 工作流当前输出 AssetId(undo/redo 后的"当前"状态) */
  getCurrentOutputs(workflowId: string): AssetId[] {
    return this.currentOutputsMap.get(workflowId) ?? [];
  }

  // history:changed 事件由 stack.onChanged 统一发射,避免双发
  async undo(workflowId: string): Promise<void> {
    const stack = this.getOrCreateStack(workflowId);
    const result = stack.undo();
    if (result === undefined) return;
    // null 表示回到初始状态 → 用 initialInputs;entry → 用其 outputs
    const newCurrent = result === null
      ? (this.initialInputsMap.get(workflowId) ?? [])
      : result.outputs;
    this.currentOutputsMap.set(workflowId, newCurrent);
  }

  async redo(workflowId: string): Promise<void> {
    const stack = this.getOrCreateStack(workflowId);
    const entry = stack.redo();
    if (entry === undefined) return;
    this.currentOutputsMap.set(workflowId, entry.outputs);
  }

  async jumpTo(workflowId: string, index: number): Promise<void> {
    const stack = this.getOrCreateStack(workflowId);
    const result = stack.jumpTo(index);
    if (result === undefined) return;
    const newCurrent = result === null
      ? (this.initialInputsMap.get(workflowId) ?? [])
      : result.outputs;
    this.currentOutputsMap.set(workflowId, newCurrent);
  }

  /**
   * run() 前的历史栈准备:
   * - appendHistory=true 且已有栈:保留栈与 currentOutputs,仅确保初始输入已记录
   * - 否则(默认重置):丢弃旧历史,重新初始化
   * 然后执行 LRU 上限清理。
   */
  prepareForRun(
    workflowId: string,
    inputIds: AssetId[],
    appendHistory: boolean
  ): void {
    if (appendHistory && this.historyStacks.has(workflowId)) {
      if (!this.initialInputsMap.has(workflowId)) {
        this.initialInputsMap.set(workflowId, inputIds);
      }
    } else {
      const existingStack = this.historyStacks.get(workflowId);
      if (existingStack) {
        existingStack.reset();
      }
      this.initialInputsMap.set(workflowId, inputIds);
      this.currentOutputsMap.set(workflowId, inputIds);
    }
    this.enforceStacksLimit(workflowId);
  }

  /** run() 成功完成后,记录最终输出为当前(outputs 非空时)。 */
  recordRunResult(workflowId: string, outputs: AssetId[]): void {
    if (outputs.length > 0) {
      this.currentOutputsMap.set(workflowId, outputs);
    }
  }

  /** node:finished 事件处理:append 到对应工作流栈,inputs 取上一步 outputs。 */
  recordFromNodeEvent(
    event: Extract<LokvisEvent, { type: 'node:finished' }>
  ): void {
    if (!event.outputs || event.outputs.length === 0) return;

    const stack = this.getOrCreateStack(event.workflowId);
    const outputs = event.outputs.map((a) => a.id);
    const inputs = this.currentOutputsMap.get(event.workflowId) ?? [];

    const entry: HistoryEntry = {
      id: generateId(),
      workflowId: event.workflowId,
      nodeId: event.nodeId,
      capability: event.capability,
      params: event.params,
      inputs,
      outputs,
      timestamp: Date.now(),
    };

    stack.append(entry);
    this.currentOutputsMap.set(event.workflowId, outputs);
  }

  /**
   * LRU 上限清理:超 MAX_CONCURRENT_WORKFLOW_STACKS 时按 FIFO 删最旧 stack
   * (reset 触发 onEvict → assetStore.remove 回收资产)。
   * appendHistory 模式下当前工作流栈必须跳过,否则 FIFO 首位时被误删。
   */
  enforceStacksLimit(currentWorkflowId: string): void {
    while (this.historyStacks.size >= MAX_CONCURRENT_WORKFLOW_STACKS) {
      let oldestId = this.historyStacks.keys().next().value;
      if (oldestId === undefined) break;
      if (oldestId === currentWorkflowId) {
        const iter = this.historyStacks.keys();
        iter.next();
        oldestId = iter.next().value;
        if (oldestId === undefined) break;
      }
      const stack = this.historyStacks.get(oldestId);
      if (stack) {
        stack.reset();
      }
      this.historyStacks.delete(oldestId);
      this.initialInputsMap.delete(oldestId);
      this.currentOutputsMap.delete(oldestId);
    }
  }

  /** 获取或创建工作流对应的 HistoryStack */
  getOrCreateStack(workflowId: string): HistoryStack {
    let stack = this.historyStacks.get(workflowId);
    if (!stack) {
      const stackConfig: Partial<HistoryStackConfig> = {
        maxEntries: DEFAULT_MAX_HISTORY,
        onEvict: (entry) => {
          // 淘汰条目时清理其 outputs 资产(避免 OPFS 泄漏)
          for (const assetId of entry.outputs) {
            this.deps.assetStore.remove(assetId).catch((err) => {
              console.warn(`[lokvis] onEvict: remove(${assetId}) failed:`, err);
            });
          }
        },
        onChanged: (wfId, entries, currentIndex) => {
          this.deps.eventBus.emit({
            type: 'history:changed',
            workflowId: wfId,
            entries,
            currentIndex,
          });
          void this.persistHistory(wfId);
        },
      };
      stack = new HistoryStack(workflowId, stackConfig);
      this.historyStacks.set(workflowId, stack);
    }
    return stack;
  }

  /** 清理指定工作流的历史栈(reset 触发 onEvict 回收资产),不取消运行中执行。 */
  disposeHistory(workflowId: string): void {
    const stack = this.historyStacks.get(workflowId);
    if (stack) {
      stack.reset();
      this.historyStacks.delete(workflowId);
    }
    this.initialInputsMap.delete(workflowId);
    this.currentOutputsMap.delete(workflowId);
  }

  /**
   * 清理所有工作流的历史栈(W21.6 runtime.dispose 用)。
   *
   * 复制 keys 后逐个 disposeHistory,触发 onEvict 回收 outputs 资产。
   * 与 disposeHistory 一样是同步操作(persistHistory 是 fire-and-forget)。
   */
  disposeAll(): void {
    // 复制一份:disposeHistory 内 stack.reset() → onEvict → assetStore.remove
    // 可能间接触发其他 listener 改动 historyStacks(理论上不会,但防御性写法)
    for (const workflowId of [...this.historyStacks.keys()]) {
      this.disposeHistory(workflowId);
    }
    this.dirtyDuringLoad.clear();
  }

  /**
   * 把工作流当前历史快照写入 historyStore(W7.2)。
   *
   * 时序:currentOutputs 从 stack snapshot 派生(cursor === -1 用 initialInputs,
   * 否则用 entries[cursor].outputs),不读 currentOutputsMap —— onChanged 在
   * undo/redo/jumpTo/run 内部同步触发时 map 尚未更新会读到旧值。
   * 竞态:多个 fire-and-forget save 的 IDB readwrite 事务由 IndexedDB 引擎按发起
   * 顺序串行化,无需应用层加链。
   * entries 为空 → delete;加载期间跳过写回,记入 dirtyDuringLoad 后续补 persist。
   */
  async persistHistory(workflowId: string): Promise<void> {
    if (!this.deps.historyStore) return;
    if (this.isLoadingHistory) {
      this.dirtyDuringLoad.add(workflowId);
      return;
    }
    // fire-and-forget 调用方用 `void this.persistHistory(...)`,故内部必须 try/catch,
    // 否则 IDB 故障会变成 unhandled promise rejection。
    try {
      const stack = this.historyStacks.get(workflowId);
      // 栈已从内存移除(disposeHistory / enforceStacksLimit 后异步到达)→ 删除持久化记录
      if (!stack) {
        await this.deps.historyStore.delete(workflowId);
        return;
      }
      const { entries, cursor } = stack.snapshot();
      if (entries.length === 0) {
        await this.deps.historyStore.delete(workflowId);
        return;
      }
      const initialInputs = this.initialInputsMap.get(workflowId) ?? [];
      const currentOutputs = cursor === -1
        ? initialInputs
        : (entries[cursor]?.outputs ?? initialInputs);
      await this.deps.historyStore.save({
        workflowId,
        entries,
        cursor,
        initialInputs,
        currentOutputs,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn(`[lokvis] persistHistory failed for workflow ${workflowId}:`, err);
    }
  }

  /**
   * 从 historyStore 预加载所有持久化的历史快照(由 createRuntime 工厂调用)。
   * 加载期间置 isLoadingHistory 守卫;被跳过的 persist 记入 dirtyDuringLoad,
   * 加载结束后补 persist,避免加载期间其他来源变更被永久丢弃。
   */
  async loadPersistedHistory(): Promise<void> {
    if (!this.deps.historyStore) return;
    let records: Awaited<ReturnType<HistoryStore['loadAll']>> = [];
    this.isLoadingHistory = true;
    try {
      records = await this.deps.historyStore.loadAll();
      for (const record of records) {
        if (record.entries.length === 0) continue; // 跳过空记录(双重防御)
        const stack = this.getOrCreateStack(record.workflowId);
        stack.restore({ entries: record.entries, cursor: record.cursor });
        this.initialInputsMap.set(record.workflowId, record.initialInputs);
        this.currentOutputsMap.set(record.workflowId, record.currentOutputs);
      }
    } finally {
      this.isLoadingHistory = false;
      // 补 persist:逐个 await 保证顺序;复制一份避免补 persist 过程中
      // 新触发 onChanged → dirtyDuringLoad 死循环
      const pending = [...this.dirtyDuringLoad];
      this.dirtyDuringLoad.clear();
      for (const wfId of pending) await this.persistHistory(wfId);
    }
  }
}
