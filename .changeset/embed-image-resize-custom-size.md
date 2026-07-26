---
"@lokvis/embed-image": patch
---

feat(embed-image): useImageResize 支持 customSize 自定义目标尺寸

- 新增 ResizeCustomSize / UseImageResizeOptions 类型,hook 签名向后兼容扩展
- customSize 优先于 preset;width/height 至少填一个,只填一个时按比例推算
- maintainAspectRatio 默认 true(fit-within),可设 false 强制拉伸
- 非法值(缺失/0/NaN)静默回落 preset 模式
- 新增返回值 customSize / setCustomSize(null 切回预设模式并立即重跑)
