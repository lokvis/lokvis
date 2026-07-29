---
"@lokvis/schema": minor
"@lokvis/capability": minor
"@lokvis/plugin-image": patch
"@lokvis/plugin-pdf": patch
"@lokvis/plugin-video": patch
"@lokvis/plugin-audio": patch
---

能力名收敛为单一事实源(架构评审 #7)。

- `@lokvis/schema` 现导出由 codegen 从 manifest 生成的 `BuiltinCapabilityName` 字面量联合类型与 `BUILTIN_CAPABILITY_NAMES` 常量数组(此前生成但从未接入公共导出)。
- 删除 `@lokvis/capability` names.ts 中长期与 manifest 漂移、且全仓无消费者的手写 `CAPABILITY_NAMES` 常量对象与 `CapabilityNameKey` 类型;保留 `CAPABILITY_DOMAINS` / `domainOf` / `actionOf` / `sameDomain`。
- plugin-image/pdf/video/audio 的操作绑定项 `capability` 字段类型由 `string` 收紧为 `BuiltinCapabilityName`,使插件裸字符串在编译期即与 manifest 单一来源校验(拼写/漂移会直接报错)。
