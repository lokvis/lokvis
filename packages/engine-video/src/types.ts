/**
 * engine-video 类型定义
 *
 * 与 engine-pdf 的 types 模式对齐:参数接口 + 共享类型集中定义,
 * 供 operations.ts(浏览器 stub)与 node/operations.ts(Node 实装)共用。
 *
 * AGENTS.md:Engine 层只暴露 Blob↔Blob 纯函数,不感知 Asset/Workflow。
 * 参数接口仅描述 Blob↔Blob 操作的入参,不含 Asset/Workflow 概念。
 *
 * VideoInfo 类型由 @lokvis/schema 定义(跨层共享),此处 re-export,
 * 避免上层(mcp-server 等)为读取视频元数据跨层依赖 engine-video。
 */

// VideoInfo 跨层共享类型从 @lokvis/schema 复用(与 ImageMetadata / PdfInfo 模式对齐)
export type { VideoInfo } from '@lokvis/schema';

/**
 * 视频引擎描述符(供 plugin-video 单点推导 stub 状态)。
 *
 * AGENTS.md Stub Engine 约定:version 含 'stub' 时视为占位实现,
 * plugin 层据此设置 isStub。每个入口(默认 stub / node / web)各导出
 * 一个 VIDEO_ENGINE 常量,消除 plugin 层硬编码 isStub 的契约漂移。
 */
export interface VideoEngineDescriptor {
  /** 引擎名(如 'ffmpeg-static' / 'ffmpeg-wasm') */
  name: string;
  /** 版本号,含 'stub' 时视为占位实现 */
  version: string;
  /** 支持(或计划支持)的 capability id 列表(AGENTS.md stub 三要素之一) */
  supportedCapabilities: string[];
}

/** 支持的视频输出容器格式 */
export type VideoOutputFormat = 'mp4' | 'webm' | 'gif';

/** 视频转码参数 */
export interface VideoTranscodeParams {
  /** 目标容器格式(必填) */
  format: VideoOutputFormat;
  /** 目标编解码器(如 libx264 / vp9,可选) */
  codec?: string;
  /** 目标比特率(bps,可选) */
  bitrate?: number;
  /** Constant Rate Factor(0=无损,51=最差,可选) */
  crf?: number;
}

/** 视频裁剪参数(按时间范围截取片段) */
export interface VideoTrimParams {
  /** 起始时间(秒,必填) */
  start: number;
  /** 结束时间(秒,必填) */
  end: number;
}

/** 视频压缩参数 */
export interface VideoCompressParams {
  /** 输出容器格式(默认 mp4) */
  format?: VideoOutputFormat;
  /** 目标比特率(bps,可选) */
  bitrate?: number;
  /** Constant Rate Factor(可选) */
  crf?: number;
  /** 缩放比例 0-1(可选,应用于分辨率) */
  scale?: number;
}

/** 视频合并参数(N→1) */
export interface VideoMergeParams {
  /** 输出容器格式(默认 mp4) */
  format?: VideoOutputFormat;
}

/** 音频提取参数 */
export interface VideoExtractAudioParams {
  /** 输出音频格式(默认 mp3) */
  format?: 'mp3' | 'aac' | 'wav';
  /** 音频比特率(bps,可选) */
  bitrate?: number;
}

/** GIF 转换参数 */
export interface VideoToGifParams {
  /** 起始时间(秒,可选) */
  start?: number;
  /** 结束时间(秒,可选) */
  end?: number;
  /** GIF 帧率(默认 15) */
  fps?: number;
  /** 输出宽度像素(可选,保持宽高比缩放) */
  width?: number;
}

/** 视频截图参数(指定时间点截取一帧) */
export interface VideoScreenshotParams {
  /** 截图时间点(秒,必填) */
  time: number;
  /** 输出图像格式(默认 png) */
  format?: 'png' | 'jpeg' | 'webp';
}
