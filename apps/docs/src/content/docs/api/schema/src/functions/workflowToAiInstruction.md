---
editUrl: false
next: false
prev: false
title: "workflowToAiInstruction"
---

> **workflowToAiInstruction**(`workflow`): [`WorkflowAiInstruction`](/docs/api/schema/src/interfaces/workflowaiinstruction/)

Defined in: [schema/src/workflow.ts:160](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/workflow.ts#L160)

把 Workflow 转换为 AI 可理解的指令描述。

注意:此函数仅做结构转换,不执行 workflow。
AI 生成的 workflow 仍由确定性 Runtime 执行(见方案 §5.3 设计原则)。

## Parameters

### workflow

[`Workflow`](/docs/api/schema/src/interfaces/workflow/)

已定义的 Workflow

## Returns

[`WorkflowAiInstruction`](/docs/api/schema/src/interfaces/workflowaiinstruction/)

AI 指令描述,含人类可读指令、依赖能力、输入 schema、示例
