/**
 * HistoryStack —— append-only 操作历史与 undo/redo
 *
 * 设计要点(对应 PROJECT_PLAN 2.1-2.5):
 * - 每个工作流拥有独立的 HistoryStack,记录每一步 transform 的 HistoryEntry。
 * - undo/redo 通过 cursor(游标)实现:cursor 指向最后一条已应用的 entry。
 * - append 新操作时,截断 cursor 之后的所有 redo 分支(标准 undo/redo 语义)。
 * - 历史上限默认 10 步,超出时 LRU 淘汰最旧条目,并回调 onEvict 通知调用方清理 OPFS 资产。
 * - 每次 append / undo / redo / clear 后通过 eventBus 发出 `history:changed` 事件。
 */

import type { AssetId, HistoryEntry } from '@lokvis/schema';
import type { EventBus } from '@lokvis/schema';

/** HistoryStack 配置 */
export interface HistoryStackOptions {
  /** 历史条目上限(默认 10) */
  maxEntries?: number;
  /** 事件总线(可选,用于发出 history:changed) */
  eventBus?: EventBus;
  /** 工作流 ID(用于事件载荷) */
  workflowId?: string;
  /** 条目被 LRU 淘汰时的回调,调用方可据此清理不再引用的 OPFS 资产 */
  onEvict?: (entries: HistoryEntry[]) => void;
}

/** undo/redo 操作结果 */
export interface HistoryStepResult {
  /** 被撤销/重做的条目 */
  entry: HistoryEntry;
  /** 撤销后应恢复为"当前"的 AssetId 列表 */
  currentAssetIds: AssetId[];
}

/** 默认历史上限 */
export const DEFAULT_MAX_HISTORY_ENTRIES = 10;

export class HistoryStack {
  private entries: HistoryEntry[] = [];
  /** cursor 指向最后一条已应用 entry;-1 表示尚未应用任何条目 */
  private cursor = -1;
  private readonly maxEntries: number;
  private readonly eventBus?: EventBus;
  private readonly workflowId?: string;
  private readonly onEvict?: (entries: HistoryEntry[]) => void;

  constructor(opts: HistoryStackOptions = {}) {
    this.maxEntries = opts.maxEntries ?? DEFAULT_MAX_HISTORY_ENTRIES;
    this.eventBus = opts.eventBus;
    this.workflowId = opts.workflowId;
    this.onEvict = opts.onEvict;
  }

  // ─── 查询 ───────────────────────────────────────────

  /** 获取全部历史条目(只读副本) */
  getAll(): HistoryEntry[] {
    return [...this.entries];
  }

  /** 获取当前游标位置(-1 表示空) */
  getCursor(): number {
    return this.cursor;
  }

  /** 历史条目总数 */
  get length(): number {
    return this.entries.length;
  }

  /** 是否可撤销 */
  canUndo(): boolean {
    return this.cursor >= 0;
  }

  /** 是否可重做 */
  canRedo(): boolean {
    return this.cursor < this.entries.length - 1;
  }

  // ─── 操作 ───────────────────────────────────────────

  /**
   * 追加一条历史记录。
   * 截断 cursor 之后的 redo 分支,并在超出上限时 LRU 淘汰最旧条目。
   */
  append(entry: HistoryEntry): void {
    // 截断 redo 分支:丢弃 cursor 之后的所有条目
    if (this.cursor < this.entries.length - 1) {
      this.entries = this.entries.slice(0, this.cursor + 1);
    }

    this.entries.push(entry);
    this.cursor = this.entries.length - 1;

    // LRU 淘汰:超出上限时移除最旧条目
    this.evictIfNeeded();

    this.emitChanged();
  }

  /**
   * 撤销一步:游标回退,返回应恢复为"当前"的 AssetId 列表(即被撤销条目的 inputs)。
   * @returns 撤销结果,或 null(无可撤销)
   */
  undo(): HistoryStepResult | null {
    if (!this.canUndo()) return null;

    const entry = this.entries[this.cursor]!;
    this.cursor--;
    this.emitChanged();
    return { entry, currentAssetIds: entry.inputs };
  }

  /**
   * 重做一步:游标前进,返回应恢复为"当前"的 AssetId 列表(即被重做条目的 outputs)。
   * @returns 重做结果,或 null(无可重做)
   */
  redo(): HistoryStepResult | null {
    if (!this.canRedo()) return null;

    this.cursor++;
    const entry = this.entries[this.cursor]!;
    this.emitChanged();
    return { entry, currentAssetIds: entry.outputs };
  }

  /** 清空全部历史 */
  clear(): void {
    this.entries = [];
    this.cursor = -1;
    this.emitChanged();
  }

  // ─── 内部 ───────────────────────────────────────────

  /** LRU 淘汰:当条目数超过 maxEntries 时,移除最旧的条目并回调 onEvict */
  private evictIfNeeded(): void {
    const evicted: HistoryEntry[] = [];
    while (this.entries.length > this.maxEntries) {
      const removed = this.entries.shift()!;
      evicted.push(removed);
      this.cursor--; // 游标同步前移
    }
    // 游标不应低于 -1
    if (this.cursor < -1) this.cursor = -1;

    if (evicted.length > 0 && this.onEvict) {
      this.onEvict(evicted);
    }
  }

  /** 发出 history:changed 事件 */
  private emitChanged(): void {
    this.eventBus?.emit({
      type: 'history:changed',
      workflowId: this.workflowId ?? '',
      entries: this.getAll(),
    });
  }
}
