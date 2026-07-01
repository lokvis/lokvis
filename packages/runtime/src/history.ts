/**
 * Lokvis History Stack
 *
 * 每个工作流拥有独立的 HistoryStack,记录每一步 transform 的 HistoryEntry。
 * undo/redo 通过 cursor(游标)实现:
 *   - cursor 指向最后一条已应用的 entry
 *   - append 新操作时截断 cursor 之后的 redo 分支
 *   - 超出上限(默认 10 步)时 LRU 淘汰最旧条目并回调 onEvict 通知清理
 *
 * 每次变更通过回调通知调用方(由 Runtime 转发为 eventBus 的 history:changed)。
 *
 * 对应 PROJECT_PLAN W2 任务 2.1 / 2.2 / 2.4。
 */
import type { HistoryEntry } from '@lokvis/schema';

/** HistoryStack 配置 */
export interface HistoryStackConfig {
  /** 历史记录上限(默认 10 步) */
  maxEntries: number;
  /** 淘汰条目时的回调,用于清理 OPFS 资产 */
  onEvict?: (entry: HistoryEntry) => void;
  /** 历史变更时的回调,用于转发为 eventBus 事件 */
  onChanged?: (workflowId: string, entries: HistoryEntry[]) => void;
}

/** HistoryStack 状态(供序列化/恢复使用) */
export interface HistoryStackSnapshot {
  entries: HistoryEntry[];
  cursor: number;
}

export class HistoryStack {
  private entries: HistoryEntry[] = [];
  /** 游标:指向最后一条已应用的 entry;-1 表示尚未应用任何条目 */
  private cursor = -1;
  private readonly config: Required<Omit<HistoryStackConfig, 'onEvict' | 'onChanged'>> &
    Pick<HistoryStackConfig, 'onEvict' | 'onChanged'>;

  constructor(
    private readonly workflowId: string,
    config: Partial<HistoryStackConfig> = {}
  ) {
    this.config = {
      maxEntries: config.maxEntries ?? 10,
      onEvict: config.onEvict,
      onChanged: config.onChanged,
    };
  }

  /** 当前可应用的条目数(cursor 之后已截断) */
  get length(): number {
    return this.entries.length;
  }

  /** cursor 位置(指向最后已应用条目,-1 表示空) */
  get currentIndex(): number {
    return this.cursor;
  }

  /** 是否可以 undo */
  get canUndo(): boolean {
    return this.cursor >= 0;
  }

  /** 是否可以 redo */
  get canRedo(): boolean {
    return this.cursor < this.entries.length - 1;
  }

  /** 所有历史条目(只读视图) */
  list(): HistoryEntry[] {
    return [...this.entries];
  }

  /** 仅返回已应用的条目(cursor 及之前) */
  applied(): HistoryEntry[] {
    return this.entries.slice(0, this.cursor + 1);
  }

  /** 仅返回 redo 分支中尚未应用的条目 */
  redoBranch(): HistoryEntry[] {
    return this.entries.slice(this.cursor + 1);
  }

  /**
   * 追加一条历史记录。
   * 若当前存在 redo 分支(cursor 之后的条目),则截断之,
   *   并对被丢弃的条目触发 onEvict(清理其 outputs 资产,避免 OPFS/IDB 泄漏)。
   * 若超过上限,从最旧端 LRU 淘汰,并触发 onEvict 回调。
   */
  append(entry: HistoryEntry): void {
    if (entry.workflowId !== this.workflowId) {
      throw new Error(
        `HistoryEntry.workflowId mismatch: expected "${this.workflowId}", got "${entry.workflowId}"`
      );
    }

    // 截断 redo 分支:cursor 之后的条目全部丢弃,并通知清理其 outputs 资产
    if (this.cursor < this.entries.length - 1) {
      const dropped = this.entries.slice(this.cursor + 1);
      this.entries = this.entries.slice(0, this.cursor + 1);
      this.notifyEvict(dropped);
    }

    this.entries.push(entry);
    this.cursor = this.entries.length - 1;

    // LRU 淘汰最旧条目
    this.evictIfNeeded();

    this.notifyChanged();
  }

  /**
   * 撤销一步:cursor 前移,返回当前应应用的 entry(即 undo 后的"当前"输出)。
   * 返回值含义:
   *   - 如果 undo 后 cursor >= 0:返回该 entry(调用方应将其 outputs 作为当前状态)
   *   - 如果 undo 后 cursor < 0(回到初始):返回 null(调用方应恢复初始 inputs)
   * 如果不能 undo(cursor < 0),返回 undefined 表示无操作。
   */
  undo(): HistoryEntry | null | undefined {
    if (!this.canUndo) return undefined;
    this.cursor -= 1;
    this.notifyChanged();
    return this.cursor >= 0 ? this.entries[this.cursor]! : null;
  }

  /**
   * 重做一步:cursor 后移,返回重做后应应用的 entry。
   * 如果不能 redo,返回 undefined 表示无操作。
   */
  redo(): HistoryEntry | undefined {
    if (!this.canRedo) return undefined;
    this.cursor += 1;
    this.notifyChanged();
    return this.entries[this.cursor]!;
  }

  /** 跳转到指定条目(按 timestamp 顺序的索引) */
  jumpTo(index: number): HistoryEntry | null | undefined {
    if (index < -1 || index >= this.entries.length) return undefined;
    this.cursor = index;
    this.notifyChanged();
    return this.cursor >= 0 ? this.entries[this.cursor]! : null;
  }

  /** 清空所有历史(不触发 onEvict,用于工作流销毁) */
  clear(): void {
    this.entries = [];
    this.cursor = -1;
    this.notifyChanged();
  }

  /** 导出快照(用于持久化到 IndexedDB) */
  snapshot(): HistoryStackSnapshot {
    return {
      entries: [...this.entries],
      cursor: this.cursor,
    };
  }

  /** 从快照恢复 */
  restore(snapshot: HistoryStackSnapshot): void {
    this.entries = [...snapshot.entries];
    this.cursor = Math.max(-1, Math.min(snapshot.cursor, this.entries.length - 1));
    this.notifyChanged();
  }

  // ─── 内部方法 ──────────────────────────────────────

  /** 对一批被丢弃的条目触发 onEvict(忽略回调抛错) */
  private notifyEvict(entries: HistoryEntry[]): void {
    const onEvict = this.config.onEvict;
    if (!onEvict || entries.length === 0) return;
    for (const entry of entries) {
      try {
        onEvict(entry);
      } catch {
        // onEvict 失败不应阻断历史操作,由调用方日志记录
      }
    }
  }

  /** 超过 maxEntries 时从最旧端淘汰,并触发 onEvict 回调 */
  private evictIfNeeded(): void {
    // 无 onEvict 回调时仍需维护上限(静默丢弃,调用方无法清理 OPFS,但内存不爆)
    if (!this.config.onEvict) {
      while (this.entries.length > this.config.maxEntries) {
        this.entries.shift();
        // cursor 跟随左移,但不低于 -1
        this.cursor = Math.max(-1, this.cursor - 1);
      }
      return;
    }

    const evicted: HistoryEntry[] = [];
    while (this.entries.length > this.config.maxEntries) {
      evicted.push(this.entries.shift()!);
      this.cursor = Math.max(-1, this.cursor - 1);
    }
    this.notifyEvict(evicted);
  }

  private notifyChanged(): void {
    this.config.onChanged?.(this.workflowId, this.list());
  }
}

/** 工厂:创建 HistoryStack */
export function createHistoryStack(
  workflowId: string,
  config?: Partial<HistoryStackConfig>
): HistoryStack {
  return new HistoryStack(workflowId, config);
}
