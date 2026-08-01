/**
 * engine-archive 类型定义
 *
 * 与 engine-audio / engine-video 的 types 模式对齐:参数接口 + 引擎描述符集中定义。
 *
 * AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow。
 * 参数接口仅描述 Blob↔Blob 操作的入参,不含 Asset/Workflow 概念。
 *
 * 与 engine-audio 的差异:archive 基于 fflate(纯 JS 零 WASM,浏览器/Node 同构),
 * 是真实实现而非 stub —— version 不含 'stub',plugin-archive 据此推导 isStub=false。
 */

/**
 * 归档引擎描述符(供 plugin-archive 单点推导 stub 状态)。
 *
 * AGENTS.md Stub Engine 约定:version 含 'stub' 时视为占位实现。
 * archive 为同构真实现,version 不含 'stub'。
 */
export interface ArchiveEngineDescriptor {
  /** 引擎名 */
  name: string;
  /** 版本号,含 'stub' 时视为占位实现 */
  version: string;
}

/** zip 打包参数(N→1) */
export interface ArchiveZipParams {
  /**
   * 各输入条目在归档内的文件名(按输入顺序对应)。
   * 缺省时按 `file-{index}{ext}` 生成,ext 由 blob.type 猜测。
   */
  names?: string[];
  /**
   * DEFLATE 压缩级别(0 = 仅存储,9 = 最大压缩)。默认 6。
   */
  level?: number;
}

/** unzip 解包参数(1→N) */
export interface ArchiveUnzipParams {
  /** 无参数(保留占位,便于未来扩展路径过滤等)。 */
  _?: never;
}

/** list 列举参数(1→1,输出 JSON) */
export interface ArchiveListParams {
  /** 无参数(保留占位)。 */
  _?: never;
}

/** 归档条目清单单项(list 输出 JSON 的元素) */
export interface ArchiveEntry {
  /** 归档内路径/文件名 */
  name: string;
  /** 解压后字节数 */
  size: number;
}
