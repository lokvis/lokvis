---
editUrl: false
next: false
prev: false
title: "EngineSelectionStrategy"
---

> **EngineSelectionStrategy** = `"first"` \| `"fastest"` \| `"balanced"`

Defined in: [schema/src/capability.ts:48](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/schema/src/capability.ts#L48)

引擎选择策略(由 CapabilityRegistry 在无显式 preferredEngine 时使用):
- `'first'`:按注册顺序取第一个(默认,确定性高,保留旧行为)
- `'fastest'`:按性能等级排序取最快(fast > medium > slow,同档按注册顺序)
- `'balanced'`:优先取与能力声明 performance 匹配的实现;无匹配则退化为 fastest
