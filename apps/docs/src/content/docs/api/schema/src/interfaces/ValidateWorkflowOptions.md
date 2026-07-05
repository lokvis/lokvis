---
editUrl: false
next: false
prev: false
title: "ValidateWorkflowOptions"
---

Defined in: [schema/src/validators.ts:131](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/validators.ts#L131)

校验 Workflow JSON。

修复 review 报告：原实现仅做 Zod 形状校验，不检查 edge 引用、保留字、DAG 合法性，
导致 demo 用 `__input__` 哨兵边时 Zod 通过但 executor 抛 "cycle"。
现增加结构层校验，让错误在入口处暴露。

W10.2 增强：新增 capability 兼容性校验(可选)。
通过 `options.resolveCapability` 回调查询 capability 的 inputTypes/outputTypes,
检查相邻节点的输出类型与下一节点的输入类型是否兼容。schema 包无法直接访问
CapabilityRegistry,故采用回调注入模式(避免五层依赖违规)。

## Param

**data**

待校验的 Workflow JSON

## Param

**options**

可选项:
  - resolveCapability: (name: string) => Capability | undefined
      返回 capability 声明;返回 undefined 时跳过该节点的兼容性校验(向后兼容)
  - maxSteps: number
      最大节点数限制(默认不限制;W10 要求 5 步,调用方按需传入)

## Properties

### resolveCapability?

> `optional` **resolveCapability?**: (`name`) => \{ `inputTypes`: `string`[]; `outputTypes`: `string`[]; \} \| `undefined`

Defined in: [schema/src/validators.ts:133](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/validators.ts#L133)

查询 capability 声明的回调(返回 undefined 时跳过该节点校验)

#### Parameters

##### name

`string`

#### Returns

\{ `inputTypes`: `string`[]; `outputTypes`: `string`[]; \} \| `undefined`

***

### maxSteps?

> `optional` **maxSteps?**: `number`

Defined in: [schema/src/validators.ts:138](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/validators.ts#L138)

最大节点数限制(可选)
