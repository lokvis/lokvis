---
title: 概览
description: Lokvis — 本地优先的浏览器工作台。一切都在你的浏览器中运行。
draft: false
head: []
---

# Lokvis

**本地优先的浏览器工作台。** 一切都在你的浏览器中运行。无需上传,无需服务器,无需妥协。

## 什么是 Lokvis?

Lokvis 是一个开放内核(open-core)平台,用于构建完全在浏览器中运行的文件处理工具。图片转换、视频压缩、PDF 合并、音频编辑 —— 全部在本地完成,无需将文件上传到服务器。

## 五层架构

1. **UI 层** — Astro 7 + React 19 + Tailwind v4
2. **Workflow 层** — 线性工作流执行器(第一年)
3. **Runtime 层** — 浏览器本地执行引擎
4. **Capability 层** — 标准化的能力抽象
5. **Engine 层** — 可插拔引擎(Canvas、Squoosh、ffmpeg.wasm 等)

## 开放内核

`lokvis-open`(MIT)提供 Runtime、schema、插件和官方 UI。`lokvis-cloud`(闭源)提供商业服务:API、Marketplace、Dashboard、Billing、Sync、AI。

## 快速开始

```bash
pnpm install
pnpm dev --filter @lokvis/web
```

## 下一步

- [阅读架构指南](/docs/architecture)
- [开始使用 SDK](/docs/getting-started)
- [浏览 Capability 目录](/docs/capabilities)
- [构建你的第一个插件](/docs/plugins)
- [将 SDK 嵌入宿主 React 应用](/docs/guides/embed-sdk)
- [嵌入单一用途的 Quick Action(压缩 / 缩放 / …)](/docs/guides/quick-actions)
- [编写你的第一个插件(分步指南)](/docs/guides/write-first-plugin)
- [不使用 React 构建自定义工作台](/docs/guides/custom-workspace)
- [在 Node.js 中使用 CLI 进行自动化](/docs/guides/cli-automation)
