/**
 * Lokvis Asset Model
 *
 * 核心设计：Runtime 只操作 AssetId，不直接持有 File 或 Blob。
 * 所有大文件通过 OPFS 引用，避免内存爆炸。
 */

/** Asset 唯一标识 */
export type AssetId = string;

/** Asset 类型枚举 */
export type AssetType =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'text'
  | 'data'
  | 'unknown';

/** Asset 元数据 */
export interface AssetMetadata {
  mimeType: string;
  /** 字节数 */
  size: number;
  /** 图像/视频尺寸 */
  dimensions?: { width: number; height: number };
  /** 视频/音频时长（秒） */
  duration?: number;
  /** PDF 页数 */
  pages?: number;
  /** 文件格式：png, mp4, pdf, mp3... */
  format: string;
}

/** Blob 在 OPFS 中的引用句柄 */
export interface BlobHandle {
  /** OPFS 中的文件路径 */
  path: string;
  /** 字节数 */
  size: number;
  /** MIME 类型 */
  mimeType: string;
}

/** 预览图句柄 */
export interface PreviewHandle {
  /** 缩略图 OPFS 路径 */
  path: string;
  width: number;
  height: number;
}

/** 处理历史记录条目 */
export interface HistoryEntry {
  id: string;
  workflowId: string;
  nodeId: string;
  capability: string;
  params: Record<string, unknown>;
  inputs: AssetId[];
  outputs: AssetId[];
  timestamp: number;
}

/** 统一 Asset 抽象 */
export interface Asset {
  id: AssetId;
  type: AssetType;
  metadata: AssetMetadata;
  /** OPFS 中的引用，不直接持有内存 */
  blob: BlobHandle;
  /** 缩略图（可选） */
  preview?: PreviewHandle;
  /** 处理历史 */
  history: HistoryEntry[];
  /** 用户标签 */
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/** 资产导入来源 */
export type AssetSource =
  | { kind: 'file'; file: File }
  | { kind: 'blob'; blob: Blob; name: string }
  | { kind: 'url'; url: string }
  | { kind: 'opfs'; path: string };
