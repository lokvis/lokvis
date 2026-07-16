# ADR-013：Capability Manifest 与 Codegen

- **状态**：Accepted
- **日期**：2026-07-13（Proposed）/ 2026-07-15（Accepted）
- **来源**：[架构深度诊断报告](../reports/architecture-deep-diagnostic-20260712.md) §W4 / [任务计划](../reports/20260712-task-plan.md) W4.1
- **Acceptance 验证**（2026-07-15）：
  - ✅ `packages/capability/manifests/{image,pdf,video,audio,ai}.manifest.json` 5 域 manifest 齐全
  - ✅ `scripts/codegen-capabilities.ts` codegen 脚本实装
  - ✅ `packages/schema/src/capability-names.generated.ts` 联合类型生成
  - ✅ `packages/capability/src/presets/{domain}.generated.ts` 5 域预设生成
  - ✅ W4.3 迁移完成：手写 `presets/{image,pdf,video,audio,ai}.ts` 已删除
  - ✅ `manifests/schema.json`（JSON Schema Draft 07）完整定义

---

## 背景

当前 Lokvis 的能力声明(Capability)以 TypeScript 手写常量形式分散在
`packages/capability/src/presets/{domain}.ts` 中(如 `IMAGE_RESIZE`、
`VIDEO_COMPRESS` 等)。这种方式存在以下问题:

1. **序列化困难**:Marketplace(Phase 3)需要将能力声明序列化为 JSON 分发,
   手写 TypeScript 常量无法直接序列化。

2. **类型同步风险**:`CAPABILITY_NAMES` 常量对象(names.ts)与
   `*_CAPABILITIES` 预设数组(presets/*.ts)分别维护,新增能力时需两处同步,
   易遗漏。

3. **跨语言互操作**:未来可能需要非 TypeScript 客户端(如 MCP server 的
   Python client)读取能力声明,JSON 是通用格式。

4. **文档滞后**:能力声明的变更不会自动反映到文档中,需手工维护
   `docs/capabilities.md`。

## 决策

引入 **Capability Manifest**(JSON 格式)作为能力声明的**唯一信息源**,
通过 **codegen** 生成 TypeScript 代码:

```
manifests/*.manifest.json  ──codegen──▶  TypeScript presets + CapabilityName 类型
```

### Manifest 格式

每个 manifest 文件描述一个域(domain)的全部能力:

```json
{
  "$schema": "./schema.json",
  "domain": "image",
  "capabilities": [
    {
      "action": "resize",
      "description": "Resize image to specified dimensions",
      "inputTypes": ["image"],
      "outputTypes": ["image"],
      "params": [
        { "name": "width", "type": "number", "required": false, "min": 1 }
      ],
      "performance": "fast",
      "batchable": true
    }
  ]
}
```

- **`domain`**:能力域,与 AssetType 对齐(如 `image`/`video`/`audio`)或
  横切域(`asset`/`ai`/`developer`)。
- **`action`**:动作名,与 domain 拼接为完整能力名(`${domain}.${action}`,
  如 `image.resize`)。使用 `action` 而非 `name` 避免与 domain 冗余。
- **`outputTypes`**:数组形式(与现有 `Capability` 接口一致),即使多数能力
  只有一种输出类型也用数组,保持类型一致性。
- **`params`**:参数 Schema,支持条件约束(type=enum 时 values 必填,
  type=array 时 items 必填)。

### Schema 自描述文件

`packages/capability/manifests/schema.json`(JSON Schema Draft 07):
- 定义顶层结构、capability 对象、param 对象、assetType 枚举
- 使用 `if/then` 约束 enum→values、array→items 的必填关系
- 可通过 `ajv` 校验任意 manifest 文件

### Codegen 边界

codegen 脚本(`scripts/codegen-capabilities.ts`,W4.2)的职责:

| 生成物 | 路径 | 内容 |
|--------|------|------|
| CapabilityName 联合类型 | `schema/src/capability-names.generated.ts` | `'image.resize' \| 'image.compress' \| ...` |
| 预设数组 | `capability/src/presets/{domain}.generated.ts` | 各域 `*_CAPABILITIES` 数组(与手写版本逐字段对应) |

**codegen 不做的事**:
- 不生成 `CapabilityImplementation`(实现仍由 plugin 手写,因实现绑定 engine)
- 不生成 plugin 的 `definePlugin()` 调用(plugin 有 installer 逻辑)
- 不修改 `CAPABILITY_NAMES` 常量对象(保留手写,仅联合类型用生成的)
- 不生成 ADR / 文档(文档由人工维护)

## 迁移策略

采用**渐进式迁移**,避免一次性大改:

1. **W4.1**(本 ADR):设计 schema + 编写 ADR,不改动现有代码
2. **W4.2**:编写 codegen 脚本,生成 `.generated.ts` 文件与手写版本 diff 验证
3. **W4.3**:逐个迁移 plugin-image / plugin-pdf / plugin-video:
   - 编写 `image.manifest.json` / `pdf.manifest.json` / `video.manifest.json`
   - 删除手写 `IMAGE_CAPABILITY_ENTRIES` 等数组
   - plugin 改为从 `.generated.ts` 导入预设
   - 每个 plugin 一个 commit,逐个验证

迁移完成后,手写 presets 文件将被 `.generated.ts` 替代(手写文件删除)。
`CAPABILITY_NAMES` 常量对象保留手写(因其在 runtime 被广泛引用,且 codegen
生成的联合类型已覆盖类型安全需求)。

## 理由

1. **JSON 作为唯一信息源**:序列化友好,跨语言可读,Marketplace 直接分发
2. **codegen 消除同步风险**:manifest 是唯一输入,类型与预设自动一致
3. **不破坏现有 API**:生成的 `.generated.ts` 导出与手写版本同名同结构,
   外部 import 路径不变
4. **Draft 07 兼容性**:选用 JSON Schema Draft 07 而非 2020-12,因 ajv-cli
   及主流工具链对 Draft 07 支持更成熟

## 后果

- **正面**:
  - 能力声明有 JSON 序列化格式,Marketplace 可直接分发
  - 类型安全由 codegen 保证,不再依赖人工同步
  - schema.json 可用于编辑器自动补全($schema 引用)

- **负面**:
  - 新增 codegen 构建步骤(turbo pipeline 中 codegen 需在 build 之前)
  - manifest 与 plugin 实现分离,新增能力时需先写 manifest 再写 impl
  - 生成文件需加 `// AUTO-GENERATED, DO NOT EDIT` 头防止误编辑

- **中性**:
  - `CAPABILITY_NAMES` 常量对象手写保留(被 runtime 广泛引用,迁移成本高)
  - 手写 presets 在 W4.3 后删除,改为 import `.generated.ts`

## 关联

- [诊断报告](../reports/architecture-deep-diagnostic-20260712.md) §W4
- [任务计划 W4.1-W4.3](../reports/20260712-task-plan.md)
- [ADR-011](./011-mcp-server.md) — MCP server 消费能力声明
- 现有 `packages/schema/src/capability.ts` — Capability 接口定义
