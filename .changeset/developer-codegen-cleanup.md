---
"@lokvis/schema": patch
"@lokvis/capability": patch
---

清理 developer.* codegen 过时注释(Task C 验收后清理):

- scripts/codegen-capabilities.ts:移除生成模板中"与手写版本逐字段对应;
  W4.3 完成迁移后,手写版本将被删除"的过时注释
  (手写版本已在 PR #28 删除,注释不再适用)
- scripts/codegen-capabilities.ts:清理 domainToPrefix 中"与手写 developer.ts 一致"
  的过时引用
- 重新运行 pnpm codegen 同步 6 个 .generated.ts 文件
  (ai/audio/developer/image/pdf/video)
