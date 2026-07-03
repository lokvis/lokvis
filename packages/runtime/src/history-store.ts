/**
 * History Store —— 历史栈 IndexedDB 持久化(W7.2)
 *
 * 把每个工作流的 HistoryStack 快照(entries + cursor)连同 initialInputs /
 * currentOutputs 一起持久化到独立 Dexie 库 `lokvis-history`,实现跨会话保留:
 * 刷新页面后,undo/redo 历史与"当前输出"游标均可恢复(前提:outputs 引用的
 * 资产仍在 OPFS/IDB 中,由 W6.6 元数据持久化保证)。
 *
 * 与 OpfsMetadataDatabase 同样的降级策略:IndexedDB 不可用时返回 undefined,
 * runtime 退化为仅内存历史(刷新后丢失,与 W2 行为一致)。
 *
 * 持久化时机(由 runtime 驱动):
 * - 历史变更(append/undo/redo/jumpTo/clear/reset):HistoryStack.onChanged 回调
 *   → runtime.persistHistory(workflowId) → save
 * - 条目清空(reset/clear):save 检测到 entries 为空时改为 delete,避免残留空记录
 * - disposeWorkflow:stack.reset() 触发 onChanged → persistHistory → delete
 *
 * 恢复时机:
 * - createRuntime 工厂构造完 impl 后调 loadPersistedHistory() 预加载所有快照
 */
import Dexie, { type Table } from 'dexie';
import type { AssetId, HistoryEntry } from '@lokvis/schema';
import { isIdbSupported } from './idb-asset-store.js';

/** 持久化的历史记录(每个工作流一条) */
export interface HistoryRecord {
  /** 主键 = 工作流 ID */
  workflowId: string;
  /** 历史条目(按时间顺序) */
  entries: HistoryEntry[];
  /** 游标:-1 表示无已应用条目;i 表示第 i 条已应用 */
  cursor: number;
  /** 工作流初始输入 AssetId(undo 回到初始时使用) */
  initialInputs: AssetId[];
  /** 工作流当前输出 AssetId(undo/redo 后的"当前"状态) */
  currentOutputs: AssetId[];
  /** 最后更新时间戳(用于排查与潜在 TTL 清理) */
  updatedAt: number;
}

/**
 * 历史持久化数据库。
 *
 * 独立于 OpfsMetadataDatabase('lokvis-opfs-metadata')与 IdbAssetStore
 * ('lokvis-assets'),避免与资产元数据冲突。表以 workflowId 为主键,
 * 额外索引 updatedAt 便于未来按时间清理陈旧记录。
 */
export class HistoryDatabase extends Dexie {
  history!: Table<HistoryRecord, string>;

  constructor(name = 'lokvis-history') {
    super(name);
    this.version(1).stores({
      history: 'workflowId, updatedAt',
    });
  }
}

/** HistoryStore 抽象接口(便于测试注入 mock) */
export interface HistoryStore {
  /** 保存(或覆盖)一条历史记录 */
  save(record: HistoryRecord): Promise<void>;
  /** 读取指定工作流的历史记录 */
  load(workflowId: string): Promise<HistoryRecord | undefined>;
  /** 读取全部历史记录(用于启动时预加载) */
  loadAll(): Promise<HistoryRecord[]>;
  /** 删除指定工作流的历史记录 */
  delete(workflowId: string): Promise<void>;
  /** 清空所有历史记录 */
  clear(): Promise<void>;
}

/** HistoryStore 工厂选项 */
export interface HistoryStoreOptions {
  /** 测试注入:自定义数据库实例 */
  dbInstance?: HistoryDatabase;
  /** 数据库名(默认 'lokvis-history';仅 dbInstance 未注入时生效) */
  dbName?: string;
}

/**
 * 创建 HistoryStore。
 *
 * IndexedDB 不可用时返回 undefined,调用方(runtime)据此跳过持久化,
 * 退化为仅内存历史模式。
 */
export function createHistoryStore(
  options: HistoryStoreOptions = {}
): HistoryStore | undefined {
  const db = resolveHistoryDb(options);
  if (!db) return undefined;

  return {
    async save(record) {
      try {
        await db.history.put(record);
      } catch (err) {
        // 持久化失败不阻断历史操作,仅 warn 便于排查
        console.warn(
          `[lokvis] history store save failed for ${record.workflowId}:`,
          err
        );
      }
    },
    async load(workflowId) {
      try {
        return await db.history.get(workflowId);
      } catch (err) {
        console.warn(
          `[lokvis] history store load failed for ${workflowId}:`,
          err
        );
        return undefined;
      }
    },
    async loadAll() {
      try {
        return await db.history.toArray();
      } catch (err) {
        console.warn('[lokvis] history store loadAll failed:', err);
        return [];
      }
    },
    async delete(workflowId) {
      try {
        await db.history.delete(workflowId);
      } catch (err) {
        console.warn(
          `[lokvis] history store delete failed for ${workflowId}:`,
          err
        );
      }
    },
    async clear() {
      try {
        await db.history.clear();
      } catch (err) {
        console.warn('[lokvis] history store clear failed:', err);
      }
    },
  };
}

/** 解析历史数据库实例(注入优先,否则在 IDB 可用时新建) */
function resolveHistoryDb(
  options: HistoryStoreOptions
): HistoryDatabase | undefined {
  if (options.dbInstance) return options.dbInstance;
  if (!isIdbSupported()) return undefined;
  try {
    return new HistoryDatabase(options.dbName);
  } catch (err) {
    console.warn(
      '[lokvis] history database init failed, falling back to memory-only:',
      err
    );
    return undefined;
  }
}
