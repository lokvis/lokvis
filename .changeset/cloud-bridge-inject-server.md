---
"@lokvis/cloud-bridge": minor
"@lokvis/mcp-server": minor
---

`createLokvisMcpServer` 新增可选 `cloud?: CloudConfig` 参数,真正落地 cloud-bridge 注入。

修复 Task A 验收缺口:cloud-bridge 包已抽取为独立包,但 `LokvisMcpOptions` 未含 `cloud` 字段,
`cli.ts` 创建的 `cloudConfig` 未传入 `createLokvisMcpServer`。

变更:
- `LokvisMcpOptions` 新增 `cloud?: CloudConfig` 字段
- `createLokvisMcpServer` 在 cloud 提供时创建 `McpAuthenticator` + `McpBilling` 并返回
- `cli.ts` 改为 `createLokvisMcpServer({ cloud: cloudConfig })`,使用返回的 `authenticator` 做启动时 API Key 验证
- 补 env 覆盖文档(`LOKVIS_UPGRADE_URL` / `LOKVIS_PLAN_QUOTAS_JSON` / `LOKVIS_PRICE_PER_CALL_CENTS`)

不传 `cloud` 时行为不变:仅本地 tool 可用,cloud AI tool 不可用。
