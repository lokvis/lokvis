---
title: CLI
description: '@lokvis/cli provides terminal access to Lokvis.'
draft: false
head: []
---

# Lokvis CLI

`@lokvis/cli` provides terminal access to Lokvis: run workflows, list capabilities, scaffold plugins.

## Install

```bash
pnpm add -g @lokvis/cli
```

## Commands

### run

```bash
lokvis run ./my-workflow.json ./input.png
```

Loads a workflow JSON and runs it on the input files. Note: capabilities that depend on browser APIs (Canvas, createImageBitmap) cannot run in Node.js — use the Web app for those.

### capabilities

```bash
lokvis capabilities
```

Lists all built-in capability declarations.

### plugin create

```bash
lokvis plugin create my-plugin
```

Scaffolds a new plugin package with the standard layout.

### version / help

```bash
lokvis version
lokvis help
```
