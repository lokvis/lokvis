# Lokvis Open · 统一任务清单

> **本文档是 lokvis-open 项目任务状态的唯一信息源**，整合 Phase 1（PROJECT_PLAN）、Phase 1.5（架构优化）、Phase 2（MCP/Engine/Workflow）及技术债务。
>
> 详细任务拆分见交叉引用文档，本文档聚焦**状态追踪与下一步行动**。
>
> 最后更新：2026-07-17

---

## 状态总览

| 阶段 | 总任务数 | ✅ 完成 | ⬜ 待办 | ⛔ 废弃 | ⏭️ 延后 | 完成率 |
|------|---------|---------|---------|---------|---------|--------|
| **Phase 1** (W1-W24) | ~95 | ~92 | 0 | 4 | 3 | 97% |
| **Phase 1.5** (架构优化) | 21 | 21 | 0 | 0 | 0 | 100% |
| **Phase 2** (MCP/Engine/Workflow) | 9 | 6 | 0 | 0 | 3 | 67% |
| **技术债务** | 16 | 9 | 7 | — | — | 56% |
| **合计** | ~141 | ~128 | 0 | 4 | 6 | 91% |

---

## Phase 1 — MVP（2026.07-12）

> 详细周级拆分见 [PROJECT_PLAN.md](./PROJECT_PLAN.md)

### 里程碑状态

| 里程碑 | 目标日期 | 状态 | 说明 |
|--------|---------|------|------|
| M1.1 Alpha | 2026.09.30 | ✅ 已达成 | 2026-07-04 W12.1 Go 决策通过 |
| M1.2 Beta | 2026.10.31 | 🟡 代码侧就绪 | 待运维部署 + 真实用户反馈 |
| M1.3 发布 | 2026.12.15 | 🟡 部分启动 | W21.1-21.7 + W22.3/22.4/22.5 + W23.1/23.2/23.3/23.4 完成 |
| M1.4 首个 $1K MRR | 2027.02.28 | ⬜ 待开始 | cloud 侧验证 |

### 按月进度

| 月 | 周次 | 主题 | 进度 |
|----|------|------|------|
| M1 | W1-W4 | 基础设施 + Runtime 加固（Worker 隔离、undo/redo、OPFS、SDK API 冻结） | ✅ 完成 |
| M2 | W5-W8 | Image 工具（7 工具 + 批量 + 水印 + 历史 + 预设库 20+） | ✅ 完成 |
| M3 | W9-W12 | Workspace UI + Workflow Layer（SPA + 拖拽编辑器 + 5 步编排 + Alpha） | ✅ 代码侧完成 |
| M4 | W13-W16 | npm 发版 + Playground 5 demo + PWA | ✅ 完成 |
| M5 | W17-W20 | SDK 公开 + 文档 + Plugin SDK Alpha + CLI 最小版 | 🟡 26/31 完成（17.2/17.3/17.4/17.5/17.6/17.7/17.8/17.11 + 18.1/18.2/18.3/18.6 + 19.1/19.2/19.3/19.4/19.5/19.6/19.7/19.9 + 20.1-20.6 完成;17.1/17.9/18.7/19.8/20.8 待办） |
| M6 | W21-W24 | 性能优化 + 跨浏览器测试 + 开源发布 + Product Hunt | 🟡 14/30 完成(W21.1-21.7 + W22.3/22.4/22.5 + W23.1/23.2/23.3/23.4) |

### M5/W17-W20 待办明细

| 任务 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| 17.1-17.9 SDK 发布 + 类型导出 + auth 钩子 + isPro + examples | P0 | 🟡 | 17.2(19 个公共类型 re-export)/17.3(auth 钩子+isPro 推导)/17.4(isPro+四环门控)/17.5(useCustomPresets hook)/17.6(embedding 示例接 cloud auth + useLokvis auth 透传)/17.7(CHANGELOG+迁移指南)/17.8(Pro 门控单测 11 用例)完成;17.1/17.9 待办 |
| 17.11 ToolLayout vs AI 文案 | P0 | ✅ | 13 个 whylokvis.* i18n key(en+zh)+ ToolLayout 底部 4 张响应式对比卡片 |
| 18.1-18.3 plugin-sdk npm + 文档 + 示例插件 | P1 | 🟡 | 18.1(npm 发版就绪度报告 + changeset minor bump + package.json 元数据补全)/18.2(architecture/plugin.mdx + plugin-sdk/README.md)/18.3(plugin-grayscale 教学插件 + 13 测试)完成 |
| 18.6 Plugin 权限沙箱 | P0 | ✅ | PluginPermissionSandbox 类(schema 接口+runtime 实现)+ installPlugin 自动应用 network guard + 25 单测 + 8 plugin test mock 更新 + changeset |
| 19.2-19.6 文档结构 + API Ref + Guides + Architecture + 交互 Playground | P0 | 🟡 | 19.1/19.2/19.5(此前)+ 19.3(starlight-typedoc 修复 10 包 200+ API 页)/19.4(4 guide 已存在)/19.6(交互式 Playground 增强:snippet 选择器 + localStorage + URL hash 分享 + 快捷键 + 30 单测)完成;19.8 待办 |
| 20.1-20.6 CLI 最小版（run/capabilities/plugin create） | P1 | ✅ | 20.1-20.6 全部完成(run 默认注入 sharp 引擎 + --input/--output + 真实 resize 集成测试 + README + 帮助文本 + cli-automation 升级 + GitHub Actions 示例) |

### M6/W21-W24 待办明细

| 任务 | 优先级 | 状态 |
|------|--------|------|
| 21.1-21.8 LCP<2.5s + WASM<5s + Bundle 分析 + 大文件 streaming + 内存泄漏 + Lighthouse | P0 | 🟡 21.1-21.7 完成(21.1 LCP 优化 commit 2605dee / 21.2 WASM 预加载基础设施 commit 8a54826 / 21.3 Bundle 分析+代码分割 commit d5dc713 / 21.4 Worker Transferable 零拷贝+isBlobRef null 修复 commit 4bc6f63 / 21.5 大图 tile-based+4K 阈值切换 commit e19ffb6 / 21.6 内存泄漏 6 commit 0fe21b8+be64b4a+23d41b9+759f858+cabf02e+ed7b156 / 21.7 Lighthouse 基线 62 分+瓶颈诊断 commit 475f2c8);21.8 缓冲任务待办 |
| 22.1-22.6 Sentry Top20 修复 + 跨浏览器测试 + Safari 降级 + Playwright E2E | P0 | 🟡 22.3/22.4/22.5 完成(browser-detect 14 项能力检测 + Firefox 降级提示 UI + 6 工具 Playwright E2E);22.1/22.2/22.6 待办 |
| 23.1-23.9 README 终版 + CONTRIBUTING + Issue/PR 模板 + 文档站公开 + GitHub Releases | P0 | 🟡 23.1/23.2/23.3/23.4 完成(23.1 README 终版:Why Lokvis 痛点对比 + 特性矩阵 + 9 徽章 + Hero GIF 占位 + 文档社区 + Star History + 数字校正 787 测试/23 包/7 示例 + npm 未发布说明;23.2 CONTRIBUTING.md;23.3 CODE_OF_CONDUCT.md;23.4 Issue/PR 模板 + CODEOWNERS);23.5/23.6/23.7/23.8/23.9 待办 |
| 24.1-24.7 Product Hunt + HN + Reddit + 发布日监控 + Phase 1 复盘 | P0 | ⬜ 全部待办 |

### 废弃任务（ADR-012 商业资产迁出）

| 任务 | 原优先级 | 废弃原因 |
|------|---------|---------|
| 1.2 apps/web 部署 Cloudflare Pages | P0 | apps/web 已迁至 cloud |
| 1.3 apps/web COOP/COEP 安全头 | P0 | 同上 |
| 17.10 首页"AI 做不到的 6 件事" | P0 | 已迁至 cloud apps/web |
| 19.10 `/mcp` 落地页 | P1 | 已迁至 cloud apps/web |

### 延后任务

| 任务 | 原优先级 | 延后至 | 原因 |
|------|---------|--------|------|
| 18.4 plugin-batch-watermark | P1 | Phase 2 | 改为 MCP tool 实现 |
| 18.5 Plugin 脚手架 | P1 | Phase 2 | 优先 MCP server |
| 20.7 plugin-dev Developer Workspace | P3 | Phase 4 | 白皮书 07 §5 明确 |

---

## Phase 1.5 — 架构优化（2026-07-13 完成）

> 详细任务拆分见 [reports/20260712-task-plan.md](./reports/20260712-task-plan.md)
>
> 触发：[architecture-deep-diagnostic-20260712.md](./reports/architecture-deep-diagnostic-20260712.md)

### W1-W2：Runtime 二次分层 + 单测

| 任务 | 状态 | 产出 |
|------|------|------|
| W1.1 抽取 quota-manager.ts | ✅ | 140 行，runtime.ts 拆分启动 |
| W1.F1 修复 4 处静默吞错 | ✅ | TD-3.1/3.2/3.3 清偿 |
| W1.2 抽取 asset-manager.ts | ✅ | 190 行 |
| W1.3 抽取 history-manager.ts | ✅ | 300 行，runtime.ts -271 行 |
| W1.4 抽取 workflow-coordinator.ts | ✅ | 157 行 |
| W1.5 抽取 mcp-manifest-builder.ts | ✅ | 108 行 |
| W1.6 抽取 plugin-context.ts | ✅ | 78 行 |
| W1.7 runtime.ts 改为 Facade | ✅ | 22 行（纯 re-export）+ runtime-impl.ts 199 行 |
| W1.8 验证 typecheck + test + coverage | ✅ | 792 测试全绿，runtime 覆盖率 90.62% |
| W2.1 提取 test-utils/fakes.ts | ✅ | OPFS fake 去重 |
| W2.2 5 个 managers 独立单测 | ✅ | 96 新测试，managers 覆盖率 99.07% |

### W3-W5：Plugin 补建 + Capability Manifest

| 任务 | 状态 | 产出 |
|------|------|------|
| W3.1 新建 plugin-audio | ✅ | 4 能力声明 + 桥接 engine-audio |
| W3.2 新建 plugin-ai | ✅ | 5 能力声明 + 桥接 engine-ai |
| W3.3 修复 engine-image AssetType 类型泄漏 | ✅ | |
| W4.1 设计 manifest schema + ADR-013 | ✅ | JSON Schema Draft 07 |
| W4.2 编写 codegen 脚本 | ✅ | 327 行，32 个能力自动生成 |
| W4.3 迁移 5 个 plugin 到 manifest | ✅ | 手写 presets 全部替换为 generated |
| W4.4 拆分 batch-processor.ts（738 行） | ✅ | 4 文件（246/207/226/52 行） |

### W6：ADR 正式化 + 白皮书修订 + 单测补齐

| 任务 | 状态 | 产出 |
|------|------|------|
| W6.1 ADR-O1/O2/O3 状态 Proposed → Accepted | ✅ | 3 个 ADR 补充 review 章节 |
| W6.2 白皮书 05 章重写 | ✅ | 删除 Marketplace 抽成，改为免费社区分享 |
| W6.3 cli / plugin-sdk 单测补齐 | ✅ | 58 + 33 测试，覆盖率 100% / 98.25% |

---

## Phase 2 — MCP / Engine / Workflow（2027.01-06）

> 详细任务拆分见 [reports/20260712-task-plan.md](./reports/20260712-task-plan.md) Phase 2 章节

### 轨道 A：MCP 主线

| 任务 | 状态 | 产出 |
|------|------|------|
| M2.1 stdio 传输 + NodeAssetStore | ✅ | 72 测试，覆盖率 88.99% |
| M2.2 engine-image-node + sharp | ✅ | 45 新测试，Node 端真实图片处理 |
| M2.3 SSE + BrowserBridge + ToolRouter | ✅ | 22 新测试，端到端验证通过 |
| **M2.4 Claude Desktop / Cursor 端到端验证** | ✅ **完成** | 可复现 e2e 脚本 + Cursor 示例 + blog post |

### 轨道 B：Engine 实装

| 任务 | 状态 | 阻塞原因 |
|------|------|---------|
| B1 engine-pdf 接 pdf-lib / mupdf wasm | ⛔ 待启动 | 7 操作实装 |
| B2 engine-video 接 ffmpeg-wasm | ⛔ 待启动 | 7 操作 + 30MB bundle 优化 |
| B3 engine-audio 接 audioworklet / ffmpeg | ⛔ 待启动 | 依赖 B2 基础设施 |

### 轨道 C：Workflow 层独立

| 任务 | 状态 | 产出 |
|------|------|------|
| C1 抽 `@lokvis/workflow` 独立包 | ✅ | `packages/workflow/` 新建；WorkflowBuilder + buildLinearWorkflow 迁入；MAX_WORKFLOW_STEPS 统一到 @lokvis/schema |
| C2 迁移 WorkflowBuilder + buildLinearWorkflow | ✅ | runtime workflow-builder.ts 改为 re-export shim；ui-react workflow-slice.ts 改用 @lokvis/workflow；workflow-coordinator.ts 修正 import 来源 |

---

## 技术债务

> 详细登记见 [technical-debt.md](./technical-debt.md)

### 债务总览

| 类别 | 数量 | 严重度 | 已清偿 | 剩余 |
|------|------|--------|--------|------|
| Phase 2 路线（功能性取舍） | 2 | 中 | 0 | 2 |
| 测试时序依赖 | 2 | 中 | 0 | 2 |
| 静默吞错 | 11 | 低 | 3 已部分修复 | 11 活动（3 部分修复 + 8 全活动） |
| 类型层面 workaround | 1 | 低 | 0 | 1（TD-4.2） |
| UI ObjectURL 生命周期 | 2 | 中 | 0 | 2 |
| 事件订阅 cleanup | 2 | 低 | 0 | 2 |
| 测试环境 hack（非债务） | 3 | — | — | 3 |
| Cloud 耦合泄漏 | 1 | 中 | 0 | 1（TD-1.5，问题 A 处理中） |

**净评估：无阻塞性债务。** 剩余均为"有防护的局部 workaround"或"Phase 2 路线性取舍"。

### Phase 2 候选清偿项

| 债务 ID | 描述 | 触发条件 |
|---------|------|---------|
| TD-1.1 | MCP Node 降级模式文件读写 | Phase 2 MCP Server v1 开发 |
| TD-1.2 | 批量队列持久化 | Phase 2 或用户反馈 |
| TD-3.4 | exif-reader 静默返回 null | 接入可观测系统时 |
| TD-4.3 | CLI 手写 type guard → zod | Phase 4 CLI 正式发布前 |
| TD-5.1 | ObjectURL 生命周期重构 | 重构 assets-slice 时 |

---

## 推荐执行顺序

### 立即可推进

1. **Phase 1 W17-W20** — SDK 公开 + 文档完善 + CLI 最小版（M5 主线）
2. **B1 + B2 并行** — PDF 与 Video 引擎实装，解锁 Phase 2 Workspace

### 中期推进

3. **Phase 1 W21-W24** — 性能优化 + 开源发布 + Product Hunt
4. **B3** — Audio 引擎（依赖 B2 ffmpeg 基础设施）

### 已完成（最近）

- ✅ **W23.2 / W23.3 / W23.4**（2026-07-17,commit 7ce9126）— 开源发布文档体系:`CONTRIBUTING.md`(环境要求 Node 22+/pnpm 9.12.0 + 初次启动 + 五层架构约束指向 AGENTS.md + oxlint/prettier + Vitest+Playwright 测试约定 + Conventional Commits + 分支命名 + PR 流程 + Issue 报告 + License 贡献,关键红线:Engine 函数签名用 Record<string,any>、禁止 as unknown as 双断言、fetch 必须检查 ok、EventBus emit 遍历副本+try/catch、File 用 new File([blob],name,{type}))+ `CODE_OF_CONDUCT.md`(Contributor Covenant 2.1,违规报告邮箱 conduct@lokvis.dev)+ `.github/ISSUE_TEMPLATE/bug_report.yml`(含隐私优先提示:不用真实用户文件)+ `feature_request.yml`(指向 PROJECT_PLAN.md §11 不做清单)+ `config.yml`(blank_issues_enabled: false)+ `PULL_REQUEST_TEMPLATE.md`(变更说明/变更类型/架构影响/验证/Breaking Changes/Checklist)+ `CODEOWNERS`(默认 @lokvis/maintainers,schema/runtime/capability/engine-image + CI/工具链显式列)+ README.md 贡献段落精简为 TL;DR 指向 CONTRIBUTING.md。
- ✅ **W22.5**（2026-07-17,commit 9e17eb3）— Playwright E2E 覆盖 6 工具主流程:`playwright.config.ts`(baseURL 5601 + webServer 自动拉起 astro dev + reuseExistingServer=!CI + 仅 chromium project + retry/trace/screenshot 配置)+ `tests/fixtures/images.ts`(Node zlib + 手工 PNG 编码生成 256×256 纯色 PNG,不依赖 sharp/canvas:CRC32 表懒初始化 + chunk(type,data) 函数 + IHDR/IDAT/IEND 三段编码,导出 makePng + TEST_PNG 红 + TEST_PNG_BLUE 蓝)+ `tests/e2e/helpers.ts`(uploadImage:对 hidden input[type=file] setInputFiles;runToolAndExpectOutput:waitForFunction 等按钮启用 + 等 Download 按钮出现)+ 6 工具 spec(resize/crop/convert/compress/watermark 单图工具用 runToolAndExpectOutput;watermark-batch 不同:先等 input attached → 上传 3 文件 → 等文件名可见 → 等 "Watermark all" 按钮启用 → 点击 → 等 3 个 Done 状态徽章)+ .gitignore 新增 test-results/playwright-report/playwright/.cache + package.json 新增 test:e2e 脚本。验证:6 工具 spec 全部通过。
- ✅ **W22.4**（2026-07-17,commit 807fd44）— Firefox / 浏览器能力降级提示 UI:`apps/playground/src/components/pwa/BrowserSupportBanner.tsx`(React useEffect + sessionStorage dismiss 模式,首次会话显示横幅,用户 dismiss 后本会话不再显示)+ `computeBanners.ts`(纯逻辑抽离:把 detectBrowserSupport() 结果映射为 banner 类型数组,便于单测)+ 7 单测覆盖全部逻辑分支(Firefox 显示提示/Chrome 不显示/dismiss 后隐藏/会话边界等)。
- ✅ **W22.3**（2026-07-17,commit d40247c）— 浏览器能力检测 + Safari 降级路径基础设施:`packages/runtime/src/browser-detect.ts`(14 项能力检测:createImageBitmap / OffscreenCanvas / OPFS / WebCodecs / WebGL2 / IndexedDB / crypto.randomUUID / WebSocket / SharedArrayBuffer / WebAssembly SIMD / ImageBitmap fullSupport / Worker module support / crossOriginIsolated / serviceWorker)+ UA 嗅探辅助(浏览器名/版本/平台/移动端/iOS Safari 特例)+ 缓存机制(默认单次检测缓存,force=true 强制重算)+ 纯函数导出 detectBrowserSupport / detectBrowser / isFirefox / isSafari / isIOS。为 22.4 降级 UI 与未来 Safari 降级路径提供基础。
- ✅ **W21.6**（2026-07-17,6 commit:0fe21b8 / be64b4a / 23d41b9 / 759f858 / cabf02e / ed7b156）— 内存泄漏修复(6 项子任务):(1) engine-image bitmap try/finally 释放避免异常路径泄漏(0fe21b8:6 个操作文件 11 个操作改为 try/finally);(2) ObjectURL revoke + 监听器/timer cleanup(be64b4a);(3) BatchQueue unmount abort — 跟踪 workflowId + mountedRef(23d41b9);(4) ToolRunner unmount abort — abortRef 清理遗漏(759f858);(5) LokvisRuntime.dispose() — 统一资源释放入口(cabf02e);(6) AssetStore dispose 方法 + Runtime ownsAssetStore 清理(ed7b156:asset-store.ts / opfs-asset-store.ts / idb-asset-store.ts 三层 + wrapAssetStoreWithQuota 透传 dispose + 内部 usage/initialized/chain 重置 + types.ts ownsAssetStore 标志 + runtime-impl.ts dispose 调用,幂等设计 + disposed 守卫)。
- ✅ **W17.6**（2026-07-15）— examples 升级:embedding 示例接 cloud auth:`UseLokvisOptions` 新增 `auth?: LokvisAuthSession` 字段,透传到 `createLokvis({ auth })`,使 `<Workspace auth={...} />` 自动支持 auth prop(WorkspaceProps extends UseLokvisOptions);`examples/embedding/App.tsx` 升级为 3 模式切换(free/pro/guest)+ 侧边栏 Auth Mode 切换器 + `key={authMode}` remount(useLokvis 只在挂载时初始化一次);README 重写新增 "Cloud auth integration" 章节(3 模式对比表 + 真实集成代码 + guest override + API token);changeset `w17-embed-cloud-auth.md` 标记 ui-react minor bump。验证:typecheck 0 errors + 78 test files / 1350 tests passed。
- ✅ **W18.1**（2026-07-15）— `@lokvis/plugin-sdk` npm 发版准备(Alpha):`package.json` 补全 npm 元数据(author/homepage/bugs.url/keywords 8 个:lokvis/plugin/sdk/image-processing/browser/local-first/capability/runtime);README "Status: Alpha" 章节更新(权限模型从 "partially enforced (advisory)" 改为 "enforced as of W18.6");新建 changeset `w18-plugin-sdk-alpha-release.md`(minor bump 0.2.2 → 0.3.0,说明 W18.1 元数据 + W18.2 文档 + W18.6 sandbox 接口);新建发版就绪度报告 `docs/reports/W18.1-plugin-sdk-npm-release-readiness.md`(6 章:发版范围 / 20 字段检查表 / changeset 状态 / 6 步运维流程 / Go 结论 / 验证记录)。实际 npm publish 由 release.yml 在 `v*` tag 推送时自动执行,运维侧待执行 changeset version + NPM_TOKEN + tag 触发。
- ✅ **W19.6**（2026-07-15）— 交互式 Playground 增强:`Playground.tsx` 新增 snippet 选择器(5 例:hello/resize/eventbus/factory/batch)+ localStorage 持久化(代码 + snippetId)+ URL hash 分享(`#code=<base64>`,URL-safe base64 + UTF-8 支持)+ Cmd/Ctrl+Enter 运行快捷键 + 运行耗时显示(ms)+ 重置/复制/分享按钮 + snippet 描述行 + modified 徽标;提取 `playground/snippets.ts` 与 `playground/share.ts` 纯函数模块;新增 9 个 i18n key(snippet/copy/share/reset/modified + 4 个 hint)中英两版;30 单测覆盖(16 share encode/decode/extract/buildShareUrl + 14 snippets 字段/查找/默认/fallback)。
- ✅ **W19.3**（2026-07-15）— API Reference 自动生成修复:`tsconfig.typedoc.json` 补全 `@lokvis/workflow` paths 映射和 include 条目;`apps/docs/typedoc.json` 新增 workflow 为第 10 个 entry point;starlight-typedoc 10 包 200+ API 页成功生成。
- ✅ **W19.4**（2026-07-15）— Guides 核验:4 个 guide 已存在(embed-sdk 182L / write-first-plugin 335L / custom-workspace 249L / cli-automation 233L),中英两版各 999 行。
- ✅ **W18.2**（2026-07-15）— Plugin SDK 文档:`architecture/plugin.mdx` 权限模型章节从 advisory 更新为 W18.6 enforced(含 7 行权限表 + Enforcement 列 + network guard 子章节 + ctx.sandbox 子章节);中英两版同步;新建 `packages/plugin-sdk/README.md`(Quick start + 3 工厂表 + BlobCapabilityOptions 接口 + PluginContext API 表 + 生命周期时序图 + Stub engine 处理 + 类型 re-export 清单)。
- ✅ **W17.5**（2026-07-15）— `useCustomPresets` hook(localStorage 持久化 + FREE_PRESET_LIMIT=3 / PRO_PRESET_LIMIT=Infinity + JSON 容错 + 跨 tab storage 事件 + 同 tab SYNC_EVENT 同步 + id 以 `custom.` 前缀与内置 PLATFORM_PRESETS 命名空间隔离;21 单测覆盖读写往返/容错/限制门控/id 生成)。
- ✅ **W17.4**（2026-07-15）— `runtime.isPro` getter + Pro 门控四环全齐:batch(10/无限)+ concurrency(4/16)+ workflow slots(5/无限)+ presets(3/无限)。
- ✅ **W17.2**（2026-07-15）— SDK 类型导出审查:补全 19 个公共类型 re-export(RuntimeStatus/RunOptions/AssetSource/EventBus 等)+ changeset。
- ✅ **W19.2**（2026-07-15）— 文档结构重整为六段式:`astro.config.mjs` sidebar 重组为 Overview / Getting Started / Architecture / Concepts(capabilities+workflows+mcp) / Guides(embed-sdk+write-first-plugin) / Plugins / Examples(custom-workspace+cli-automation) / Reference(sdk+cli+roadmap);中英两版同步;slug 不变不断链;`pnpm --filter @lokvis/docs typecheck` 0 errors。
- ✅ **W18.3**（2026-07-15）— 示例插件 `plugin-grayscale`(教学用):`examples/plugin-grayscale/`,`grayscalePlugin()` 注册 `image.grayscale` 能力,自包含 canvas 灰度化 operation(decode→逐像素→encode),3 种算法(luminance/average/lightness);13 测试覆盖插件常量/installer 注册数/factory 返回数/stub status/execute 抛错/三种算法 + abort;README 含 30 秒速览 + 算法表 + 与官方 plugin-image 对比表。
- ✅ **W19.5**（2026-07-15）— Architecture 深度文补强:修复 `architecture.mdx` 断链(`docs/whitepaper/` → `docs/business/`,中英两版);新增"四层协作"综述章节,串联 Runtime/Capability/Plugin/Engine 请求流 + 单向依赖 + 四篇深度文档链接(中英两版)。四层深度文(runtime/engine/capability/plugin)此前已存在且完整。
- ✅ **W20.6**（2026-07-15）— `examples/cli-automation` 升级:`automate.ts` 移除过时 Node 限制说明,真实跑 image.resize(1920x1080→1280x720 PNG 174ms);新增 `.github/workflows/resize-ci.yml` GitHub Actions CI gate 示例;README 重写。W20 CLI 最小版全部完成。
- ✅ **W20.5**（2026-07-15）— CLI README 新建(`packages/cli/README.md`):命令清单 + 用法示例 + Node 端 5 真实图像能力表 + 编程式 API + 限制说明;`version.ts` 同步到 0.2.2(原硬编码 0.1.0 与 package.json 不同步);help 文本 W20.1 已更新覆盖 --input/--output。
- ✅ **W20.4**（2026-07-15）— CLI 集成测试 `packages/cli/src/__tests__/integration/run-resize.integration.test.ts`,3 测试覆盖 resize(200x100→100x50 PNG) + compress(PNG→JPEG) + 无 --output 路径,真实 sharp 引擎端到端跑通,作为持续验证 CLI 端到端可用性的护栏。
- ✅ **W20.1/20.2/20.3**（2026-07-15）— CLI `run` 命令默认注入 `imageToolsPluginNode`(sharp 引擎),支持 `--input`/`--output` 选项;Node 端真实跑图像工作流端到端验证通过(256x192→64x48 PNG 37ms)。`capabilities` 与 `plugin create` 命令核验通过。
- ✅ **M2.4**（2026-07-15）— Claude Desktop / Cursor 端到端验证 + 可复现 demo + blog post（详见 [blog](./blog/2026-07-15-mcp-first-local-tools.md)）

---

## 交叉引用

| 文档 | 说明 |
|------|------|
| [PROJECT_PLAN.md](./PROJECT_PLAN.md) | Phase 1 W1-W24 小时级任务拆分（详细） |
| [reports/20260712-task-plan.md](./reports/20260712-task-plan.md) | Phase 1.5 + Phase 2 任务拆分（详细） |
| [technical-debt.md](./technical-debt.md) | 技术债务登记簿（完整） |
| [roadmap.md](./roadmap.md) | 三年四阶段战略路线图 |
| [AI生态冲击调整方案.md](./AI生态冲击调整方案.md) | MCP-first 战略转型背景 |
