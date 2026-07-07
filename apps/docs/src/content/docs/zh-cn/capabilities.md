---
title: Capabilities
description: Lokvis 对所有 capability 使用 <domain>.<action> 命名约定。
draft: false
head: []
---

# Capabilities

Capability 使用 `<domain>.<action>` 命名约定。Runtime 永远不感知具体的 Engine——只知道 capability。

## 域(Domains)

- `asset.*` — 横切型 asset 操作
- `image.*` — 图片处理
- `video.*` — 视频处理
- `audio.*` — 音频处理
- `pdf.*` — PDF 操作
- `ai.*` — AI 驱动的操作
- `developer.*` — 开发者工具(自省、性能分析)

## 内置 Capability

### 图片(Image)

- `image.resize` — 调整尺寸,支持多种 fit 策略(cover/contain/fill/inside/outside)
- `image.compress` — 压缩,按质量或目标大小
- `image.convert` — 转换格式(png/jpeg/webp/avif/gif)
- `image.crop` — 裁剪到指定区域
- `image.rotate` — 按角度旋转
- `image.flip` — 水平/垂直/双向翻转
- `image.watermark` — 添加文字或图片水印
- `image.background` — 设置背景色

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

### Asset

- `asset.rename` — 基于模式的重命名(`{name}` `{index}` `{date}`)
- `asset.archive` — 将 asset 打包为 zip

### 开发者(Developer)

- `developer.inspect.capabilities`
- `developer.inspect.asset`
- `developer.validate.workflow`
- `developer.profile`

## 自定义 Capability

Plugin 可以声明任意名称的自定义 capability。标准化的命名有助于 Marketplace 搜索、工作流可移植性,以及 AI 工作流生成。
