---
"@lokvis/embed-image": patch
---

feat(embed-image): 新增 useImageBatch 批量图片处理 hook(Layer 0,纯逻辑无 UI)

- 面向"多文件 + 同一能力 + 参数整体调整"批处理场景(如批量缩放)
- 顺序调度:任一时刻最多一个 item 处于 processing,避免并发导入/执行的内存峰值与 OPFS 写入竞争
- buildParams(info) 按 item 的 inputInfo 计算参数,支持 resize 'half' 等依赖原图尺寸的预设
- paramsKey 变化时非 processing 的 item 重置 queued 重跑;buildParams 经 ref 读取最新闭包
- 单 item 失败只落在 item.error,不中断后续;hook 级仅有 initError
- inputUrl ObjectURL 在 addFiles 创建,removeItem / reset / unmount 统一 revoke
- 返回 doneCount / totalInputBytes / totalOutputBytes 统计与 onBatchComplete 整批完成回调(埋点用)
- 从 '@lokvis/embed-image' 与 '@lokvis/embed-image/hooks' 双路径导出
