# ADR-020 engine-core 处置决议：改造为 Node ffmpeg 共享层

- 状态：已接受（FO-09 决议，2026-08-04）
- 关联：FO-09 / FO-11（20260804 全项目审查修复方案）

## 背景

`packages/engine-core` 当前只导出 `createEngineRegistry`，且 engine-audio / engine-video
已移除对它的引用，成为零消费方孤儿包。同时 engine-video / engine-audio 的 Node
operations 各自重复实现了一份 ffmpeg stdio 调用逻辑（spawn、stderr 收集、
concat demuxer 合并、trim 区间校验、format→MIME 映射），重复约 ~150 行。

## 决议

采用方案 A（联动 FO-11）：**保留 engine-core 并改造为 Node ffmpeg 共享层**。

- engine-core 将导出 `getFfmpegPath / runFfmpegStdio / runFfmpegConcatMerge /
  validateTrimRange / mimeForFormat`（FO-11 实施）
- engine-video / engine-audio 的 node 入口改为从 `@lokvis/engine-core` 导入
- 错误文案模板保持原样（stderr 尾部 2000 字符）

未采用方案 B（删包）：删包虽消除孤儿，但两包 Node 侧的 ffmpeg 重复代码会
长期存在，且未来新增 Node engine（如 engine-gif）仍会第三次复制。

## 后果

- FO-11 完成前 engine-core 仍无消费方，属过渡态，验收以 FO-11 为准
- engine-core 成为 Node-only 共享层，不得引入浏览器 API
