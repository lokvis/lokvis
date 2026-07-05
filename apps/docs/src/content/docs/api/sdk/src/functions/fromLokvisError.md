---
editUrl: false
next: false
prev: false
title: "fromLokvisError"
---

> **fromLokvisError**(`value`): [`LokvisError`](/docs/api/sdk/src/classes/lokviserror/)

Defined in: [sdk/src/errors.ts:328](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/sdk/src/errors.ts#L328)

把任意值归一为 LokvisError。

归一优先级:
1. 已是 LokvisError → 原样返回
2. 是 runtime 抛出的具体 Error 子类(QuotaExceededError 等)→ instanceof 匹配,包装为对应 SDK 错误
3. 是普通 Error 但 message 匹配已知模式 → best-effort 字符串匹配,转成对应 SDK 错误
   (runtime 部分模块仍抛普通 Error,待后续 runtime 层类型化后可移除此层)
4. 其他普通 Error → 包装为 UNKNOWN LokvisError,保留 cause
5. 非 Error 值 → 字符串化为 message

使用 `instanceof` 为主、message 模式匹配为辅:instanceof 准确且不受文案改动影响,
但 runtime 仍有未类型化的 `throw new Error(...)`,message 匹配作为兜底保证
ASSET_NOT_FOUND / WORKFLOW_INVALID / WORKFLOW_CYCLE / CAPABILITY_NOT_REGISTERED
等 code 也能命中,让消费方的 switch(err.code) 分支稳定可用。

## Parameters

### value

`unknown`

## Returns

[`LokvisError`](/docs/api/sdk/src/classes/lokviserror/)

## Example

```ts
import { fromLokvisError } from '@lokvis/sdk';

try {
  await lokvis.run(wf, [id]);
} catch (e) {
  const err = fromLokvisError(e);
  telemetry.report(err.code, err.message, err.context);
}
```
