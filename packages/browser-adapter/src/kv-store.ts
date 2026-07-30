/**
 * KVStoreFactory —— IndexedDB(Dexie)键值存储封装(ADR-015)
 *
 * 收编 runtime 内三个 Dexie 库的构造(lokvis-assets /
 * lokvis-opfs-metadata / lokvis-history)。Dexie 依赖随本实现移入
 * adapter,runtime 依赖树变轻。
 *
 * 定位:泛型单表 KV 存储(inline key)。三级降级链(OPFS→IDB→内存)
 * 等业务策略仍留在 runtime,这里只下沉"触碰 IndexedDB 的那一行"。
 *
 * 环境安全约定:构造本身不触碰 indexedDB(Dexie 懒 open);
 * 调用方应先用 isIdbSupported() 决定是否走 IDB 路径。
 */

import Dexie, { type Table } from 'dexie';

/** 泛型单表 KV 存储(记录含 inline 主键) */
export interface KVStore<T> {
  /** 按主键读取(不存在返回 undefined) */
  get(key: string): Promise<T | undefined>;
  /** 写入(或覆盖)一条记录(主键取自记录的 keyPath 字段) */
  put(record: T): Promise<void>;
  /** 按主键删除(幂等) */
  delete(key: string): Promise<void>;
  /** 读取全部记录 */
  toArray(): Promise<T[]>;
  /** 清空表 */
  clear(): Promise<void>;
  /** 关闭底层连接(数据不删除,重新创建 store 可恢复) */
  close(): void;
}

/** createKVStore 配置 */
export interface KVStoreOptions {
  /** IndexedDB 数据库名 */
  dbName: string;
  /** 表名 */
  tableName: string;
  /** inline 主键字段名 */
  keyPath: string;
  /** 二级索引字段名(可选) */
  indexes?: string[];
}

/** 内部 Dexie 封装(单表,schema 由 options 派生) */
class KVDatabase extends Dexie {
  constructor(options: KVStoreOptions) {
    super(options.dbName);
    const schema = [options.keyPath, ...(options.indexes ?? [])].join(', ');
    this.version(1).stores({ [options.tableName]: schema });
  }
}

/**
 * 创建 IndexedDB 后端的泛型 KV 存储。
 *
 * 全仓唯一允许出现 Dexie / indexedDB 访问的模块。
 */
export function createKVStore<T>(options: KVStoreOptions): KVStore<T> {
  const db = new KVDatabase(options);
  const table = db.table(options.tableName) as Table<T, string>;

  return {
    async get(key) {
      return table.get(key);
    },
    async put(record) {
      await table.put(record);
    },
    async delete(key) {
      await table.delete(key);
    },
    async toArray() {
      return table.toArray();
    },
    async clear() {
      await table.clear();
    },
    close() {
      db.close();
    },
  };
}
