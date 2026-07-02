# 路线图（Roadmap）

> 三年四阶段战略。本文档整合了 Starlight 文档站路线图、PROJECT_PLAN、白皮书 07 与 AI 调整方案。

---

## 战略总览

```
2026 H2            2027 H1            2027 H2            2028 H1-H2
│                  │                  │                  │
├─ Phase 1: MVP ───┼─ Phase 2: 扩展 ──┼─ Phase 3: 生态 ──┼─ Phase 4: 平台 ──┤
│  0-6 月          │  6-12 月          │  12-24 月         │  24-36 月       │
│                  │                  │                  │                  │
│  Image WS        │  PDF + Video WS  │  Marketplace     │  Enterprise     │
│  本地处理验证     │  MCP Server v1   │  AI Workflow     │  Desktop App    │
│  基础 SEO         │  Plugin SDK α    │  开发者生态       │  国际化         │
└──────────────────┴──────────────────┴──────────────────┴─────────────────┘
```

### 阶段目标摘要

| 阶段 | 时间 | 核心目标 | 关键指标 | 团队规模 |
|------|------|---------|---------|---------|
| **Phase 1** | 2026.07-12 | Image Workspace MVP，验证 PMF | 5K-20K 月访问 / 100-500 Pro | 1-2 人 |
| **Phase 2** | 2027.01-06 | PDF + Video + MCP Server v1 | 3万-10万月访问 / $271K ARR | 2-3 人 |
| **Phase 3** | 2027.07-2028.06 | Marketplace + 开发者生态 | 10万-50万月访问 / $1.77M ARR | 4-6 人 |
| **Phase 4** | 2028.07-2029.06 | 企业版 + 桌面版 + 国际化 | 50万+月访问 / $10.57M ARR | 8-12 人 |

---

## Phase 1 — MVP（2026.07-12）

**核心命题**：验证"本地处理 + 工作流编排"的产品市场契合度（PMF）

### P0 必交付

- Image Workspace：格式转换 / 压缩 / Resize / 裁剪 / 水印
- 批量处理（拖拽多文件 + 队列）
- 5 步线性工作流编辑器
- 20+ 平台预设
- Web Worker 隔离 + OPFS/IndexedDB 三级存储降级
- undo/redo（10 步 HistoryStack）
- PWA 可安装
- 隐私声明"文件未上传"指示器
- npm 包发版 + Playground 5 demo
- MCP server 接口设计草案（W11-W12，P1）

### 关键里程碑

| 里程碑 | 目标日期 | 验收标准 |
|--------|---------|---------|
| M1.1 Alpha | 2026.09.30 | 6 工具 + 批量 + 历史 + workflow 可用 |
| M1.2 Beta | 2026.10.31 | playground 上线，npm beta 发版，崩溃率 <3% |
| M1.3 发布 | 2026.12.15 | Product Hunt 发布，1000+ 访问 |

### Phase 1 不做清单

- ❌ Video/PDF/Audio/AI Workspace（Phase 2+）
- ❌ 分支/循环/条件/并行 Workflow（Year 2）
- ❌ Cloud 侧功能（API/Marketplace/Auth/Billing/Sync）
- ❌ 工具站 + SEO 页 + Workspace SPA（已迁至 cloud，ADR-012）
- ❌ Plugin SDK v1 正式（仅 Alpha P1）
- ❌ CLI 正式发布（仅最小 `run` 命令 P1）
- ❌ GIF 制作 / 图片拼接（P2）

详细任务拆分见 [PROJECT_PLAN.md](./PROJECT_PLAN.md)。

---

## Phase 2 — 扩展（2027.01-06）

**核心命题**：从单一 Image 扩展至多 Workspace，MCP Server v1 发布

### 核心交付

- **PDF Workspace**（M7-8）：merge / split / compress / OCR / sign / watermark
- **Video Workspace**（M9-10）：compress / transcode / trim / merge / to-gif
- **MCP Server v1（新增，P0）**：
  - `@lokvis/mcp-server` 包实现
  - stdio 传输 + 浏览器优先 + Node 降级
  - 5 个 image tools + batch + workflow
  - Claude Desktop / Cursor 集成测试
  - npm 发布 + MCP registry 提交
  - 工时：96h P0 + 12h P1
- **Plugin SDK v1 → 降级为 Alpha**：MCP-first，Marketplace → 免费社区分享
- **engine-ai cloudProxyEngine**：AI 辅助 workflow 设计
- Cloud Pro 订阅（$9/月）
- SEO 内容扩展（PDF/Video 工具页 100+）

### 成功指标

| 指标 | 目标 |
|------|------|
| 月访问量 | 50K+ |
| MRR | $22K+ |
| Plugin 数量 | 20+ |
| 30 日留存 | 15%+ |

---

## Phase 3 — 生态（2027.07-2028.06）

**核心命题**：Marketplace 上线，开发者生态启动，AI 辅助工作流生成

### 核心交付

- **Workflow Marketplace**：搜索 / 发布 / 版本管理 / 70-30 分成 / 评价体系
- **AI Workflow 生成**：自然语言 → Workflow Schema / 优化建议 / 错误诊断
- **Audio Workspace**：trim / merge / transcode / normalize / denoise / whisper
- **国际化**：英/中/日/西/德/法 + PPP 定价
- 企业版预览：SSO / 审计日志 / 私有部署
- MCP SSE 模式（实验性）

### 成功指标

| 指标 | 目标 |
|------|------|
| MAU | 50K+ |
| MRR | $150K+ |
| Marketplace 工作流 | 1,000+ |
| 活跃开发者 | 200+ |

---

## Phase 4 — 平台（2028.07-2029.06）

**核心命题**：从工具集合进化为浏览器原生应用平台

### 核心交付

- **桌面版**：Tauri 打包（macOS/Windows/Linux）
- **企业版**：私有部署 / 白标 / SOC 2 Type II
- **AI Workspace**：本地 Whisper / SAM / Stable Diffusion 轻量版
- **Data Workspace**：CSV / JSON / SQLite
- **Developer Workspace**：Regex / Diff / Base64 / Hash / JWT
- **平台开放**：CLI 正式 / 公共 API / Webhook / 嵌入式 Widget
- Plugin SDK v1 正式（如有需求）

### 成功指标

| 指标 | 目标 |
|------|------|
| ARR | $10M+ |
| MAU | 150K+ |
| 企业客户 | 100+ |
| 桌面版安装 | 50K+ |

---

## Go/No-Go 决策点

每个阶段结束必须通过评审：

### Phase 1 → Phase 2（2026.12）

- ✅ MAU ≥ 3,000
- ✅ Pro 用户 ≥ 30
- ✅ 30 日留存 ≥ 5%
- ✅ 崩溃率 <3%
- ❌ 若未达成 → 重新评估产品方向

### Phase 2 → Phase 3（2027.06）

- ✅ MAU ≥ 15,000
- ✅ MRR ≥ $15,000
- ✅ 30 日留存 ≥ 15%
- ✅ 5+ 第三方 Plugin
- ❌ 若未达成 → 延缓 Marketplace

### Phase 3 → Phase 4（2028.06）

- ✅ MAU ≥ 50,000
- ✅ MRR ≥ $100,000
- ✅ 100+ Marketplace 工作流
- ❌ 若未达成 → 推迟企业版与桌面版

---

## Workspace 推出顺序

| 优先级 | Workspace | 推出时间 | 理由 |
|--------|-----------|---------|------|
| P0 | Image | 2026 Q3 | 市场最大、技术最成熟 |
| P1 | PDF | 2027 Q1 | 刚需、隐私敏感、本地优势 |
| P1 | Video | 2027 Q2 | 市场大、差异化明显 |
| P2 | Audio | 2028 Q1 | 中等市场 |
| P2 | AI | 2028 Q3 | 趋势、高壁垒 |
| P3 | Data | 2028 Q4 | 开发者导向 |
| P3 | Developer | 2029 Q1 | 留存价值高 |

---

## 商业化演进

```
Phase 1: 一次性购买 $49
         ↓
Phase 2: + Cloud Pro 订阅 $9/月
         ↓
Phase 3: + Marketplace 分成（70/30）
         + 企业版 $1000+/年
         ↓
Phase 4: + 白标授权 $10K+
         + SDK 授权
         + 桌面版 $99
```

---

*本文档整合自 `apps/docs/src/content/docs/roadmap.md`、PROJECT_PLAN.md、白皮书 07 与 AI 调整方案。*
