/**
 * ffmpeg-static 类型声明
 *
 * ffmpeg-static 包只导出 ffmpeg 二进制路径(string),无 TypeScript 类型。
 * 本声明提供最小类型,使 engine-audio/node 能通过 typecheck。
 *
 * 与 engine-video 处理 ffmpeg-static 的模式对齐:optional peerDependency,
 * 本声明仅供编译期类型解析。
 */
declare module 'ffmpeg-static' {
  /** ffmpeg 预编译二进制文件的绝对路径 */
  const ffmpegPath: string;
  export default ffmpegPath;
}
