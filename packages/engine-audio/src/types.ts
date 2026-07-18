/**
 * engine-audio 类型定义
 *
 * 与 engine-video / engine-pdf 的 types 模式对齐:参数接口 + 共享类型集中定义,
 * 供 operations.ts(浏览器 stub)与 node/operations.ts(Node 实装)共用。
 *
 * AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow。
 * 参数接口仅描述 Blob↔Blob 操作的入参,不含 Asset/Workflow 概念。
 */

/** 支持的音频输出容器格式 */
export type AudioOutputFormat = 'mp3' | 'wav' | 'ogg' | 'aac';

/** 音频裁剪参数(按时间范围截取片段) */
export interface AudioTrimParams {
  /** 起始时间(秒,必填) */
  start: number;
  /** 结束时间(秒,必填) */
  end: number;
}

/** 音频合并参数(N→1) */
export interface AudioMergeParams {
  /** 输出容器格式(默认 mp3) */
  format?: AudioOutputFormat;
  /** 合并过渡(可选,Phase 2 扩展) */
  transition?: 'none' | 'fade' | 'cut';
}

/** 音频转码参数 */
export interface AudioTranscodeParams {
  /** 目标容器格式(必填) */
  format: AudioOutputFormat;
  /** 目标比特率(bps,可选) */
  bitrate?: number;
}

/** 音频标准化参数 */
export interface AudioNormalizeParams {
  /** 目标响度(dB,可选,默认 -16 LUFS 等效) */
  level?: number;
}
