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
lokvis run ./workflow.json -i ./input.png -o ./output.png
```

Loads a workflow JSON and runs it on the input files. Options: `-i/--input`, `-o/--output`. The CLI injects Node.js engines (e.g. sharp for image) so most workflows run without a browser.

### validate

```bash
lokvis validate ./my-workflow.json
lokvis validate ./my-workflow.json --max-steps 5 --json
```

Validates a workflow JSON file without executing it. Checks structure, node IDs, edge integrity, and DAG acyclicity. Options: `--max-steps`, `--json`.

### list

```bash
lokvis list ./workflows/
lokvis list . --all --json
```

Lists workflow JSON files in a directory. Options: `--all` (include hidden), `--json`, `--max-depth`.

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
