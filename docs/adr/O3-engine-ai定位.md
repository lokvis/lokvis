# ADR-O3：engine-ai 定位为 AI 辅助 workflow 设计

- **状态**：Accepted
- **日期**：2026-07-01（Proposed）/ 2026-07-13（Accepted）
- **来源**：[AI 生态冲击调整方案](../AI生态冲击调整方案.md) §5

---

## 背景

AI Agent 自主编排能力增强，Lokvis 原定位"AI 替代手动 workflow 编排"与 AI Agent 重叠。Lokvis 无法在 AI 能力上与 AI 平台直接竞争。

## 决策

engine-ai 的 `generate-workflow` / `optimize-workflow` 定位为"**AI 辅助设计**"，执行仍由确定性 Runtime 完成。

### 能力定位

| 能力 | 定位 | 实现时机 |
|------|------|----------|
| `ai.generate-workflow` | AI 辅助生成 workflow JSON（用户描述意图 → AI 输出 workflow） | Phase 2 |
| `ai.optimize-workflow` | AI 分析现有 workflow 并建议优化 | Phase 2 |
| `ai.ocr` | 本地 OCR（隐私差异化） | Phase 2 |
| `ai.caption` | 本地图片描述（无障碍/SEO） | Phase 2.5 |
| `ai.background-remove` | 本地背景移除 | Phase 2.5 |

### 设计原则

1. **AI 只设计，不执行**：AI 生成的 workflow 仍由确定性 Runtime 执行，避免随机性
2. **本地 AI 优先**：`transformersEngine` 优先实现，作为隐私差异化卖点
3. **云端 AI 可选**：`cloudProxyEngine` 接 lokvis-cloud 的 `/ai/*` 端点，Phase 2 才启用

### engine-ai 现状

```typescript
// transformersEngine：本地 AI（OCR/caption/background-remove）
// cloudProxyEngine：云端 AI（generate-workflow/optimize-workflow）
// 当前均为 stub，所有方法抛 Not Implemented
```

### 代码修改

**不修改代码**，仅更新文档与注释：

```typescript
/**
 * @lokvis/engine-ai
 * 
 * 定位：AI 辅助 workflow 设计，不替代确定性执行。
 * 
 * 设计原则：
 * 1. AI 只设计，不执行
 * 2. 本地 AI 优先（transformers.js 在浏览器内运行）
 * 3. 云端 AI 可选（需用户授权 + AI Credits）
 * 
 * Phase 1：stub 占位
 * Phase 2：实现 cloudProxyEngine + transformersEngine OCR
 */
```

## 理由

1. "AI 设计 + 确定性执行" = 混合架构，兼顾灵活性与可靠性
2. 本地 AI（transformers.js）作为隐私差异化卖点
3. 避免与 AI 平台直接竞争

## 后果

- engine-ai 代码不修改，仅文档更新
- Phase 2 实现 cloudProxyEngine 接口
- 营销突出"AI 辅助设计 + 确定性执行"

---

## 2026-07 review（Accepted 依据）

决策已落地，代码与 ADR 完全一致：

| 决策项 | ADR 承诺 | 实际代码状态 | 一致性 |
|--------|---------|-------------|--------|
| AI 只设计不执行 | 生成的 workflow 由 Runtime 确定性执行 | `engine-ai/src/index.ts` 头注释明确"AI 辅助 workflow 设计，不替代确定性执行"；`generateWorkflow` 返回 workflow 结构，执行仍由 Runtime 完成 | ✅ |
| 本地 AI 优先 | transformersEngine 浏览器内运行 | `transformersEngine`（version `0.0.0-stub`）声明 `supportedCapabilities: ['ai.ocr', 'ai.caption', 'ai.background-remove']`，`isSupported()` 检查 WebAssembly | ✅ |
| 云端 AI 可选 | cloudProxyEngine 接 lokvis-cloud | `cloudProxyEngine`（version `0.0.0-stub`）声明 `supportedCapabilities: ['ai.generate-workflow', 'ai.optimize-workflow']`，`isSupported()` 返回 false（需登录态） | ✅ |
| Phase 1 stub 占位 | 所有方法抛 Not Implemented | 两个引擎所有方法均抛 `not implemented in stub`，符合 AGENTS.md stub 约定 | ✅ |
| W3.2 plugin-ai 桥接 | — | `packages/plugin-ai/` 已建立，桥接 engine-ai 到 capability 层（ocr/caption/background-remove 走 transformersEngine，generate-workflow 走 cloudProxyEngine），各 entry 按所属引擎独立计算 isStub | ✅ |
| Open Core 边界 | cloud-proxy 实现属 lokvis-cloud | 头注释明确"本包只定义接口与 transformers.js 占位；实际 cloud-proxy 实现属于 lokvis-cloud，不在本仓库" | ✅ |

**结论**：engine-ai 的"AI 辅助设计 + 确定性执行"定位在代码中完整体现，双引擎（transformersEngine 本地 + cloudProxyEngine 云端）stub 占位就绪，plugin-ai 桥接完成。Phase 2 将实装 cloudProxyEngine 接口 + transformersEngine OCR，本 ADR 标记为 Accepted。
