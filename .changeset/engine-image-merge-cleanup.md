---
"@lokvis/engine-image": patch
"@lokvis/cli": patch
---

Task B 合并后的清理与一致性修复:

- vitest.config.ts:移除冗余的 `packages/engine-image/src/node/**/*.ts` include
  (已被 `packages/engine-image/src/**/*.ts` 完全覆盖)
- cli/package.json:sharp 版本从 ^0.34.5 对齐到 ^0.33.0
  (与 engine-image peerDependency ^0.33.0 一致,避免安装两个版本)
- engine-image node-operations.test.ts:清理迁移期注释
  (废弃 milestone M2.2 引用 + "从原 engine-image-node 迁移"说明,git history 已有记录)
