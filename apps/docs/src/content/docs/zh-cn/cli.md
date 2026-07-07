---
title: CLI
description: '@lokvis/cli 提供对 Lokvis 的终端访问。'
draft: false
head: []
---

# Lokvis CLI

`@lokvis/cli` 提供对 Lokvis 的终端访问:运行工作流、列出能力、生成插件脚手架。

## 安装

```bash
pnpm add -g @lokvis/cli
```

## 命令

### run

```bash
lokvis run ./my-workflow.json ./input.png
```

加载工作流 JSON 并在输入文件上运行。注意:依赖浏览器 API(Canvas、createImageBitmap)的能力无法在 Node.js 中运行 —— 这类能力请使用 Web 应用处理。

### capabilities

```bash
lokvis capabilities
```

列出所有内置能力声明。

### plugin create

```bash
lokvis plugin create my-plugin
```

按标准布局生成一个新的插件包脚手架。

### version / help

```bash
lokvis version
lokvis help
```
