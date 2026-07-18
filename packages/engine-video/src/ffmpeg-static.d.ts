/**
 * ffmpeg-static 类型声明
 *
 * ffmpeg-static 包只导出 ffmpeg 二进制路径(string),无 TypeScript 类型。
 * 本声明提供最小类型,使 engine-video/node 能通过 typecheck。
 *
 * 与 engine-image 处理 sharp 的模式对齐:sharp 是 optional peerDependency,
 * 由 @types/sharp 提供 Node 端类型;ffmpeg-static 无 @types,故本文件提供
 * 最小声明。
 */
declare module 'ffmpeg-static' {
  /** ffmpeg 预编译二进制文件的绝对路径 */
  const ffmpegPath: string;
  export default ffmpegPath;
}
