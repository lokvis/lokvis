# AGENTS.md

AI 编码助手在修改本项目代码时应遵循的约定。

## 架构约束

五层架构，**单向依赖**，禁止跨层引用：

```
UI → Workflow → Runtime → Capability → Engine
```

- **Engine** 层只暴露 Blob ↔ Blob 的纯函数操作，不感知 Asset/Workflow
- **Capability** 层（plugin-*）负责 Asset ↔ Blob 转换，是 Engine 与 Runtime 的桥梁
- **Runtime** 层调度 Capability，不直接依赖任何 Engine 包

## 类型安全

### Engine 操作函数的参数签名

Engine 层的操作函数统一接受 `Record<string, any>` 作为参数类型：

```typescript
// 正确
export async function resize(blob: Blob, params: Record<string, any>): Promise<Blob>

// 错误 — 不接受具体接口类型（会导致上游 `as unknown as` 双断言）
export async function resize(blob: Blob, params: ResizeParams): Promise<Blob>
```

原因：Capability 层（plugin-*）从 executor 收到的参数是 `Record<string, unknown>`，
TypeScript 不允许直接将 interface 类型与 `Record<string, unknown>` 互转。
Engine 层使用 `Record<string, any>` 后，内部用单次 `as` 断言即可，上游无需断言。

### 禁止 `as unknown as` 双断言

Plugin 层（plugin-image / plugin-pdf / plugin-video）的操作包装函数中，
**禁止** `as unknown as` 双断言。如果 engine 函数签名正确（`Record<string, any>`），
直接传递 params 即可。唯一的例外是 Worker scope 等跨边界场景。

## Stub Engine 处理

当 Engine 适配器为占位实现（`version` 包含 `'stub'`）时：

1. Plugin 层在 `buildXxxCapabilityImplementations()` 中读取 `engine.version.includes('stub')`
2. 通过 plugin-sdk 的三个工厂把布尔值传给实现，工厂据此设置
   `CapabilityImplementation.status = 'stub'`：
   - `createBlobCapabilityImpl({ isStub })` — 1→1（single）
   - `createMergeCapabilityImpl({ isStub })` — N→1（merge）
   - `createSplitCapabilityImpl({ isStub })` — 1→N（split）
3. `CapabilityRegistry.resolve()` 自动跳过 stub 实现
4. Executor 在 stub-only 时给出明确错误提示

注意：stub 标识由各 plugin 的 `buildXxxCapabilityImplementations()`
一次性计算，并经工厂传给实现，避免在多个包装点重复检测。
不存在 `wrapAsImplementation()` / `wrapMergeOrSplitImplementation()`
等泛化包装函数 —— 形态分发由各 plugin 用 entries + kind 字段自行驱动。

新增 Engine 包时，确保 stub 实现：
- `version` 字段包含 `'stub'` 标识
- 所有操作方法抛出 `new Error('xxx not implemented in stub')`
- `supportedCapabilities` 列出未来计划支持的能力

## fetch 响应校验

所有 `fetch()` 调用**必须**检查 `response.ok`：

```typescript
const resp = await fetch(url);
if (!resp.ok) {
  throw new Error(`Request failed: ${resp.status} ${resp.statusText}`);
}
```

## File 对象构造

Node.js 环境中构造 File 对象时，使用标准 API：

```typescript
// 正确
const file = new File([blob], name, { type: blob.type });

// 错误 — 展开 Blob 会丢失原型方法
const file = { ...blob, name } as unknown as File;
```

## 事件总线安全

EventBus 的 `emit()` 中对 `anyHandlers` 迭代：
- 必须遍历 `[...set]`（展开副本），不能直接 `for...of set`
- 每个 handler 调用必须 try/catch 包裹，防止一个 handler 异常中断后续分发

## 测试约定

- 框架：Vitest，`globals: false`（显式 import）
- 位置：`src/__tests__/<module>.test.ts`
- 中文测试描述
- 浏览器 API（Canvas / OPFS / IndexedDB）使用 fake 实现
- 核心包（runtime / schema / capability / engine-image）需要测试覆盖
- 各 plugin-* 包（plugin-image / plugin-video / plugin-pdf / plugin-audio / plugin-ai）
  均需 `__tests__/plugin.test.ts` 覆盖：插件常量、installer 注册数、
  `buildXxxCapabilityImplementations` 返回数、stub status、execute 抛错
- 覆盖率目标：lines 60%+，branches 75%+

## 常用命令

```bash
pnpm typecheck          # 全量类型检查（通过 turbo）
pnpm test               # 运行测试
pnpm test:coverage      # 运行测试 + 覆盖率
pnpm build              # 构建所有包
```
