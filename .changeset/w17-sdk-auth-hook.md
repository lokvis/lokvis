---
"@lokvis/sdk": minor
---

新增 `createLokvis({ auth })` 钩子,对接 cloud 侧 session/token 注入(W17.3)。

`CreateLokvisOptions` 新增可选 `auth: LokvisAuthSession` 字段:

```ts
export interface LokvisAuthSession {
  session?: string; // cloud 会话令牌(如 JWT)
  token?: string;   // 直接 API token(CLI / 后端场景)
  isPro?: boolean; // 显式覆盖,优先级高于 session/token presence
}
```

SDK 据 presence 推导 `isPro` 并传给 RuntimeConfig,使 Runtime 的批量上限
(`FREE_BATCH_LIMIT=10`)/并发槽位(4 → 16)/workflow 槽位(5 → ∞)自动放宽。
SDK 不做 token 形态/签名校验 —— 校验由 cloud 网关完成,本地无 secret。

### 迁移指南(0.2.2 → 0.3.0)

**纯本地场景(无 cloud 对接)**:无需改动。不传 `auth` 时行为不变,
保持 free 模式(`isPro = false`)。

**接 cloud session**:

```ts
// 之前:仅本地模式
const lokvis = await createLokvis({ plugins: [imageToolsPlugin()] });

// 之后:cloud 注入 session,自动开启 Pro 门控
const cloudJwt = await fetchCloudSession(userOAuthCode);
const lokvis = await createLokvis({
  plugins: [imageToolsPlugin()],
  auth: { session: cloudJwt },
});

console.log(lokvis.isPro); // true — 批量无上限
```

**显式标记游客 session**:cloud 已识别为游客(发 session 但不应享受 Pro):

```ts
const lokvis = await createLokvis({
  auth: { session: guestJwt, isPro: false },
});
console.log(lokvis.isPro); // false — 仍受 FREE_BATCH_LIMIT 约束
```

**测试 / dev 模式无凭证**:绕过 cloud,本地直接开 Pro:

```ts
const lokvis = await createLokvis({ auth: { isPro: true } });
// 或直接走 RuntimeConfig(向后兼容)
const lokvis2 = await createLokvis({ isPro: true });
```

### 受影响的下游行为

| 项 | free(`isPro=false`) | Pro(`isPro=true`) |
|---|---|---|
| BatchProcessor.enqueue 上限 | 10 项(抛 `BatchLimitExceededError`) | 无上限 |
| BatchProcessor 默认并发 | 4 | 16 |
| UI workflow 槽位 | 5 | ∞ |
| Playground 自定义预设 | 3 | ∞ |

错误类型 `BatchLimitExceededError` 在 Pro 模式下永远不会抛出 ——
批量上限仅在 free 模式下生效。

### 不变项

- `createLokvis()` 不传任何参数:行为完全不变,`isPro === false`
- 直接传 `RuntimeConfig.isPro` 仍有效(向后兼容路径)
- 已有的 `loadPlugin(runtime, plugin)` API 未变
