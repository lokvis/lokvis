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
lokvis run ./workflow.json -i ./input.png -o ./output.png
```

加载工作流 JSON 并在输入文件上运行。选项:`-i/--input`、`-o/--output`。CLI 注入 Node.js 引擎(如 sharp),多数 workflow 无需浏览器即可运行。

### validate

```bash
lokvis validate ./my-workflow.json
lokvis validate ./my-workflow.json --max-steps 5 --json
```

校验工作流 JSON 文件(不执行)。检查结构、节点 ID、边完整性和 DAG 无环性。选项:`--max-steps`、`--json`。

### list

```bash
lokvis list ./workflows/
lokvis list . --all --json
```

列出目录中的工作流 JSON 文件。选项:`--all`(含隐藏)、`--json`、`--max-depth`。

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
