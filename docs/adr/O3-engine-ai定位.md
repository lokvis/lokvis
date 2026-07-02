# ADR-O3：engine-ai 定位为 AI 辅助 workflow 设计

- **状态**：Proposed
- **日期**：2026-07-01
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
