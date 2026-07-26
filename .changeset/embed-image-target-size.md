---
"@lokvis/embed-image": patch
---

feat(embed-image): useImageCompress 支持 targetSizeKB 目标体积压缩

- 新增 UseImageCompressOptions.targetSizeKB 选项,设置后进入 target 模式
- 质量二分迭代(5–95,最多 7 轮)+ sqrt 降维回退(最多 2 次),格式固定 webp
- 新增返回值:targetSizeKB / targetMet / effectiveQuality / setTargetSizeKB
- useImageTool 新增 commitOutput(blob) 直接写入迭代最优结果,避免二次编码
- EmbedActionResult 向后兼容扩展 quality? / targetSizeKB? / targetMet?
- 修复并发 bug:runningRef 生命周期锁替代 tool.busy 守卫
- 稳定回调身份:toolRef 模式消除 [tool] 依赖导致的每 render 重建
