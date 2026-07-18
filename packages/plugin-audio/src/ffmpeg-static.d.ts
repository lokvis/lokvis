/**
 * ffmpeg-static 类型声明(plugin-audio 本地副本)
 *
 * 与 packages/engine-audio/src/ffmpeg-static.d.ts 内容一致。
 * TypeScript 的 ambient module declarations 不跨包传递,故消费方
 * (plugin-audio)需各自提供一份声明以通过 typecheck。
 *
 * 实际运行时由 @lokvis/engine-audio/node 动态 import ffmpeg-static,
 * 本声明仅供编译期类型解析。
 */
declare module 'ffmpeg-static' {
  /** ffmpeg 预编译二进制文件的绝对路径 */
  const ffmpegPath: string;
  export default ffmpegPath;
}
