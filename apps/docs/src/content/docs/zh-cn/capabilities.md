---
title: 能力(Capabilities)
description: Lokvis 对所有能力使用 <domain>.<action> 命名约定。
draft: false
head: []
---

# 能力(Capabilities)

能力(Capability)使用 `<domain>.<action>` 命名约定。Runtime 从不感知具体引擎 —— 只感知能力。

## 领域

- `asset.*` — 跨领域的资源(asset)操作
- `image.*` — 图片处理
- `video.*` — 视频处理
- `audio.*` — 音频处理
- `pdf.*` — PDF 操作
- `ai.*` — AI 驱动的操作
- `developer.*` — 开发者工具(内省、性能分析)

## 内置能力

### 图片(Image)

- `image.resize` — 调整尺寸,支持多种适应策略(cover/contain/fill/inside/outside)
- `image.compress` — 按质量或目标大小压缩
- `image.convert` — 转换格式(png/jpeg/webp/avif/gif)
- `image.crop` — 裁剪到指定区域
- `image.rotate` — 按角度旋转
- `image.flip` — 水平 / 垂直 / 双向翻转
- `image.watermark` — 添加文字或图片水印
- `image.background` — 设置背景色
- `image.filter` — 应用滤镜预设(grayscale/invert/sepia/blur),blur 可指定 `radius`

### 视频(Video)

- `video.compress`
- `video.transcode`
- `video.trim`
- `video.merge`
- `video.extract-audio`
- `video.to-gif`
- `video.screenshot`

### PDF

- `pdf.merge`
- `pdf.split`
- `pdf.compress`
- `pdf.rotate`
- `pdf.watermark`
- `pdf.ocr`
- `pdf.sign`

### 音频(Audio)

- `audio.trim` — 按时间段裁剪
- `audio.merge` — 多段拼接
- `audio.transcode` — 转码(MP3/WAV/OGG/AAC)
- `audio.normalize` — 音量标准化到目标响度

> 注:`audio.denoise` 在前期文档中曾出现,但 manifest 与 engine-audio 均未声明该能力。如未来需要降噪,需在 `packages/capability/manifests/audio.manifest.json`、`engine-audio`、`plugin-audio` 三处同步补齐。

### AI

- `ai.generate-workflow` — AI 辅助生成 workflow JSON(cloudProxyEngine)
- `ai.optimize-workflow` — 优化已有 workflow(cloudProxyEngine)
- `ai.ocr` — 本地 OCR(transformersEngine)
- `ai.caption` — 图片描述,用于无障碍/SEO(transformersEngine)
- `ai.background-remove` — 背景移除(transformersEngine)

### 资源(Asset)

- `asset.rename` — 基于模式的重命名(`{name}` `{index}` `{date}`)
- `asset.archive` — 将资源打包为 zip

### 开发者(Developer)

- `developer.inspect.capabilities`
- `developer.inspect.asset`
- `developer.validate.workflow`
- `developer.profile`

## 自定义能力

插件(Plugin)可以声明任意名称的自定义能力。标准化的命名有助于 Marketplace 搜索、工作流可移植性,以及 AI 工作流生成。
