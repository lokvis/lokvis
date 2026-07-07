---
title: CLI
description: '@lokvis/cli 提供通过终端访问 Lokvis 的能力。'
draft: false
head: []
---

# Lokvis CLI

`@lokvis/cli` 提供通过终端访问 Lokvis 的能力:运行工作流、列出 capability、生成 Plugin 脚手架。

## 安装

```bash
pnpm add -g @lokvis/cli
```

## 命令

### run

```bash
lokvis run ./my-workflow.json ./input.png
```

加载一个工作流 JSON,并在输入文件上运行它。注意:依赖浏览器 API(Canvas、createImageBitmap)的 capability 无法在 Node.js 中运行——请使用 Web 应用处理这些场景。

### capabilities

```bash
lokvis capabilities
```

列出所有内置的 capability 声明。

### plugin create

```bash
lokvis plugin create my-plugin
```

按标准布局生成一个新的 Plugin 包脚手架。

### version / help

```bash
lokvis version
lokvis help
```
