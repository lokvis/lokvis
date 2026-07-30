/**
 * History Store —— 历史栈 IndexedDB 持久化(W7.2)
 *
 * 把每个工作流的 HistoryStack 快照(entries + cursor)连同 initialInputs /
 * currentOutputs 一起持久化到独立 KV 库 `lokvis-history`(经
 * @lokvis/browser-adapter KVStoreFactory,ADR-015),实现跨会话保留:
 * 刷新页面后,undo/redo 历史与"当前输出"游标均可恢复(前提:outputs 引用的
 * 资产仍在 OPFS/IDB 中,由 W6.6 元数据持久化保证)。
 *
 * 与 OPFS 元数据库同样的降级策略:IndexedDB 不可用时返回 undefined,
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
import {
  createKVStore,
  isIdbSupported,
  type KVStore,
} from '@lokvis/browser-adapter';
import type { AssetId, HistoryEntry } from '@lokvis/schema';

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
  /** 测试注入:自定义 KV 存储实例(ADR-015 后替代原 Dexie dbInstance) */
  kvStore?: KVStore<HistoryRecord>;
  /** 数据库名(默认 'lokvis-history';仅 kvStore 未注入时生效) */
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
  const kv = resolveHistoryStore(options);
  if (!kv) return undefined;

  return {
    async save(record) {
      try {
        await kv.put(record);
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
        return await kv.get(workflowId);
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
        return await kv.toArray();
      } catch (err) {
        console.warn('[lokvis] history store loadAll failed:', err);
        return [];
      }
    },
    async delete(workflowId) {
      try {
        await kv.delete(workflowId);
      } catch (err) {
        console.warn(
          `[lokvis] history store delete failed for ${workflowId}:`,
          err
        );
      }
    },
    async clear() {
      try {
        await kv.clear();
      } catch (err) {
        console.warn('[lokvis] history store clear failed:', err);
      }
    },
  };
}

/** 解析历史 KV 存储(注入优先,否则在 IDB 可用时新建) */
function resolveHistoryStore(
  options: HistoryStoreOptions
): KVStore<HistoryRecord> | undefined {
  if (options.kvStore) return options.kvStore;
  if (!isIdbSupported()) return undefined;
  try {
    return createKVStore<HistoryRecord>({
      // 独立于 'lokvis-opfs-metadata' 与 'lokvis-assets',避免与资产元数据冲突;
      // 额外索引 updatedAt 便于未来按时间清理陈旧记录
      dbName: options.dbName ?? 'lokvis-history',
      tableName: 'history',
      keyPath: 'workflowId',
      indexes: ['updatedAt'],
    });
  } catch (err) {
    console.warn(
      '[lokvis] history database init failed, falling back to memory-only:',
      err
    );
    return undefined;
  }
}
