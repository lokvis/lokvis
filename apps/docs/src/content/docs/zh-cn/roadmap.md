---
title: 路线图
description: Lokvis 跨越四个阶段的开发路线图。
draft: false
head: []
---

# 路线图

完整计划请参见 `docs/whitepaper/07-路线图与里程碑.md`。

## Phase 1 — MVP(第 1-3 个月)

**重点:** 图片工作台(Image Workspace)

- 图片格式转换(png/jpeg/webp/avif/gif)
- 图片压缩(目标大小 / 质量)
- 调整尺寸 / 裁剪 / 旋转 / 翻转
- 水印(文字 + 图片)
- 批量处理
- 5 步线性工作流编辑器
- 50 个 SEO 落地页
- 可安装的 PWA

## Phase 2 — 扩展(第 4-6 个月)

- 视频工作台(ffmpeg.wasm)
- PDF 工作台(pdf-lib)
- 音频工作台(Web Audio API)
- **MCP Server v1(新增,P0)** — 通过 Model Context Protocol 将 Lokvis 能力暴露给 Claude / ChatGPT / Cursor。参见 [MCP 集成](./mcp)。
- Plugin SDK v1 → **降级为 Alpha**;MCP 优先。Marketplace → 免费社区共享。
- 用户账号与同步

## Phase 3 — 智能(第 7-9 个月)

- AI 工作流生成
- OCR / 字幕 / 背景移除
- 通过 Durable Objects 实现多设备同步
- Marketplace 公开发布

## Phase 4 — 平台(第 10-12 个月)

- 公开 Plugin SDK + Marketplace
- 分支工作流(DAG)
- 面向开发者的 API 访问
- 企业版
