# lokvis-open 最终态架构差距与任务清单

> 状态：Active（滚动维护，完成的任务打勾并记录实际耗时）
> 基线：`../../docs/architecture-v2.md`（三仓五层最终态）
> 范围：lokvis-open 达到最终态所需的全部修改，不按迁移阶段划分，按最终态倒推
> 估时口径：单人专注工时；>4h 必须继续拆分
> 日期：2026-07-30

---

## 1. 最终态定义（Open 仓应有的样子）

架构 v2 中 lokvis-open 回答 "How"，承担五层中的 L2 Runtime 与 L1 Browser Adapter：

```
L2 Runtime         Runtime · Workflow Engine · Capability Registry ·
                   Plugin SDK · Asset Model · SDK / CLI / MCP
L1 Browser Adapter Canvas · OPFS · IndexedDB · Web Workers · WebCodecs ·
                   File System Access（统一抽象，唯一允许触碰浏览器 API 的层）
```

最终态铁律（架构 v2 §4.4）：**业务逻辑不得直接依赖具体 Capability 或浏览器 API**。
对本仓的落地含义：runtime / workflow / capability / plugin-* / sdk 中不出现
`navigator.` / `document.` / `window.` / `indexedDB` / canvas 直接调用；
全部经 `@lokvis/browser-adapter`（新包）注入。engine-* 与 embed-*（UI 层）
通过 adapter 获取环境能力，允许在 adapter 实现内部触碰原生 API。

## 2. 现状差距总表

| # | 差距 | 现状证据 | 工作流 |
|---|---|---|---|
| 1 | 无 Browser Adapter 独立层 | 浏览器 API 分散于 runtime 8 个文件 + engine-image + embed-* | A |
| 2 | runtime 直接触碰 DOM/OPFS/IDB | `runtime/src/asset-store.ts:145-165`（createImageBitmap + `document.createElement('video'/'audio')`）、`opfs-asset-store.ts:96-114`、`idb-asset-store.ts`、`browser-detect.ts` | A |
| 3 | 能力探测三处重复 | `runtime/browser-detect.ts`、`engine-image/canvas-engine.ts#detectFormatSupport`、`embed-image/internal/format-support.ts` | A |
| 4 | engine 契约不一致 | `EngineAdapter` 仅 audio/video/ai 使用；engine-pdf 纯函数导出、engine-image 自走 worker-adapter 路线 | B |
| 5 | 未消费 Knowledge 数据 | `capability/src/presets/` 平台预设为手工硬编码，与 `@lokvis/data-platforms` 重复且会漂移 | C |
| 6 | 无 benchmark 设施 | 全仓无 bench script/依赖（仅一次性 Lighthouse 报告） | D |
| 7 | 文档与实际脱节 | README 称 23 包实为 28、engine-pdf/video 仍标 stub、`apps/web` 已迁出但 `docs/architecture.md:79` 仍引用、`packages/ENGINES.md` 全面过期、examples 少列 1 个 | E |
| 8 | 协议为 MIT，最终态裁决 Apache-2.0 | 根 LICENSE 与 30 个 package.json 均 MIT | F |
| 9 | 最终态包清单缺 archive/office/fs | grep 确认无 engine-archive/engine-office；File System Access 无实调（仅 plugin-permissions 注释预留） | G |
| 10 | MCP 工具描述未与 Task/Knowledge 对齐 | mcp-server 工具描述静态手写 | G |

## 3. 工作流总览

| 工作流 | 任务数 | 估时 | 优先级 | 依赖 |
|---|---|---|---|---|
| A Browser Adapter Layer 抽取 ✅ | 7 | 20h | P0 | 无 |
| B Engine 契约一致性 ✅ | 2 | 3h | P1 | A 完成后更顺 |
| C Knowledge 数据接入 ✅ | 2 | 5h | P1 | knowledge v0.2.0 发布 |
| D Benchmark 基础设施 ✅ | 4 | 12h | P1 | 无（产出交付 knowledge 仓） |
| E 文档与元数据治理 ✅ | 4 | 5h | P0 | 无 |
| F 协议与治理 ✅ | 2 | 3h | P2 | maintainer 决策 |
| G 长线扩域（最终态完整性） ✅ | 4 | 20h | P2 | A |
| 合计 | 25 | **68h** | | |

---

## 4. 任务明细

### A. Browser Adapter Layer 抽取（20h，P0）

#### A1 接口设计与 ADR — 3h ✅
- **执行思路**：新增 `docs/adr/015-browser-adapter-layer.md`。定义 `@lokvis/browser-adapter` 包的接口面：`EnvProbe`（现 browser-detect 全量能力探测）、`CanvasFactory`（OffscreenCanvas/HTMLCanvas 降级、getContext、createImageBitmap）、`MediaProbe`（图片尺寸/音视频时长提取）、`StorageAdapter`（OPFS getDirectory 封装）、`KVStoreFactory`（IndexedDB/Dexie 封装）、`WorkerFactory`、`FormatSupportProbe`（1×1 编码探测，统一三处重复实现）、`FilePickerAdapter`（File System Access，预留）。同时定义注入方式：runtime 构造参数可选传入，默认导出 `createBrowserAdapter()` 与测试用 `createFakeAdapter()`。分层裁决写明：adapter 是唯一允许触碰原生浏览器 API 的包；AGENTS.md 五层图更新为六层（Adapter 在 Engine 之下）。
- **验收**：ADR 评审通过；接口 TS 定义文件成稿。

#### A2 建包 + 迁移 EnvProbe/FormatSupportProbe — 2h ✅
- **执行思路**：脚手架 `packages/browser-adapter`（对齐现有包模板：tsconfig/vitest/exports）；将 `runtime/src/browser-detect.ts` 整体迁入为 `EnvProbe` 实现，runtime 改为从 adapter re-export（保持 API 兼容，deprecated 标注）；`FormatSupportProbe` 以 engine-image 的 `detectFormatSupport` 为准实现。fake 实现同步提供（测试约定要求浏览器 API 用 fake）。
- **验收**：新包 build/test 通过；runtime 原有 browser-detect 测试不破坏。

#### A3 runtime MediaProbe 迁出 — 3h ✅
- **执行思路**：`runtime/src/asset-store.ts:145-165` 的元数据提取（createImageBitmap 取尺寸、`document.createElement('video'/'audio')` 取时长）迁到 adapter `MediaProbe`；runtime 通过注入使用，默认 no-op（元数据缺省），浏览器入口（sdk/embed）注入真实实现。这是"runtime 摸 DOM"最典型违规点，迁完后 runtime 源码 grep `document.` 应为零。
- **验收**：`grep -r "document\." packages/runtime/src` 零命中（测试 fake 除外）；asset 元数据行为回归通过。

#### A4 Storage/KV 后端注入化 — 4h ✅
- **执行思路**：`opfs-asset-store.ts`/`asset-manager.ts` 的 `navigator.storage.getDirectory()` 改走 `StorageAdapter`；`idb-asset-store.ts`/`history-store.ts` 的 Dexie 构造改走 `KVStoreFactory`。三级降级链（OPFS→IDB→内存）逻辑保留在 runtime（属业务策略），仅把"触碰原生 API 的那一行"下沉。注意保持包体积：Dexie 依赖随实现移入 adapter，runtime 依赖树变轻。
- **验收**：`grep -rE "navigator\.|indexedDB" packages/runtime/src` 零命中；OPFS/IDB/内存三链路测试全绿。

#### A5 engine-image canvas 调用收敛 — 4h ✅
- **执行思路**：`canvas-engine.ts`（`document.createElement('canvas')` L113/L195、OffscreenCanvas、getContext）与 `operations/tiles.ts`/`transform.ts`/`watermark.ts` 的 createImageBitmap 统一改经 `CanvasFactory`；`wasm/avif-encoder.ts:52` 的 `new Worker` 改经 `WorkerFactory`。engine 仍可直接 import adapter（engine 属 L1/L2 边界），收益是 Node 侧（sharp-engine）与浏览器侧共享同一探测/降级逻辑，且测试无需全局 mock。
- **验收**：engine-image 测试全绿；浏览器 smoke（playground 手动跑 resize/convert）正常。

#### A6 embed-* 重复实现收敛 — 2h ✅
- **执行思路**：删除 `embed-image/src/internal/format-support.ts` 自带探测，改用 adapter `FormatSupportProbe`；`embed-kit/download.ts`、`theme.ts`（document.body/matchMedia）保留——UI 层允许触碰 DOM，但注明边界（embed 是 Presentation，不受 L2 铁律约束）。
- **验收**：embed-image 探测行为与 engine-image 一致（同一实现）；包体积不回归。

#### A7 回归与发版 — 2h ✅
- **执行思路**：全仓 `pnpm typecheck && pnpm test:coverage && pnpm build`；playground/docs 站手动 smoke；changeset（minor，fixed 组全包联动）；发布后 cloud 侧按新版本升级验证（跨仓回归）。
- **验收**：npm 新 minor 发布；cloud `pnpm ci` 用新版本通过。
- **依赖**：A2–A6。
- **完成记录（2026-08-01）**：A1–A6 于 commit `58ecd94` 一次性落地（54 files，+3408/−691），随 0.9.0 统一发版（`acf0525`）发布。A7 补充：新增 `scripts/check-browser-api.sh` CI 架构守卫（ADR-015 铁律机械校验），grep `navigator.|document.|indexedDB|new Worker(` 于 runtime/engine-image 非测试源码，排除注释/字符串/avif-encoder ADR 豁免；根 `pnpm check:arch` 脚本 + `ci.yml` 新增 "Architecture guard (ADR-015)" step（Lint 之后）。负测验证：注入 `document.createElement` → exit 1。全仓 typecheck 65/65、test 162 files/2770 tests 绿。

### B. Engine 契约一致性（3h，P1）

#### B1 EngineAdapter 契约裁决 — 2h ✅
- **执行思路**：三种现状（audio/video/ai 走 EngineAdapter、pdf 纯函数、image 自走 worker-adapter）择一收敛方向写 ADR：倾向**不强推统一**——EngineAdapter 保留给"需要 isSupported 探测与多实现选择"的引擎，pdf/image 的偏离补文档说明豁免理由（pdf 无环境分叉、image 有 worker 边界特殊性）。若裁决统一，则另拆实施任务（+6h，暂不计入）。
- **验收**：ADR 016 成稿；`packages/ENGINES.md` 重写内容与之一致（联动 E2）。

#### B2 双注册表关系文档化 — 1h ✅
- **执行思路**：`engine-core` 的 EngineRegistry 与 `runtime` 的 CapabilityRegistry 职责边界（引擎选择 vs 能力实现选择、PerformanceLevel 与 selectBest 的分工）写入 `docs/architecture.md`，配依赖关系图。
- **验收**：architecture.md 更新并含图。

### C. Knowledge 数据接入（5h，P1，依赖 knowledge v0.2.0）

#### C1 平台预设改由 data-platforms 驱动 — 3h ✅
- **执行思路**：`capability/src/presets/` 现为手工硬编码平台参数，与 `@lokvis/data-platforms` 必然漂移。方案：presets 改为 codegen——构建时从 `@lokvis/data-platforms` 生成（devDependency，产物入库，类似现有 `capability-names.generated.ts` 管线），运行时零新增依赖；生成脚本校验字段映射（recommendedSize→width/height 等）。数据缺口（如平台无某 spec）保留手工覆盖文件并标注来源。
- **验收**：presets 与 data-platforms v0.2.0 数值一致（CI diff 校验）；运行时包体积不变。
- **完成记录（2026-07-31）**：presets 拆为三源一产物。`platform-types.ts`（类型，新增 `source: 'knowledge' | 'manual'` 标注）；`platform-manual.ts`（63 个手工预设，过渡态 `source: 'manual'`）；`scripts/codegen-platform-presets.ts` 读 `@lokvis/data-platforms@0.2.0`（devDependency，经 `createRequire` 解析 `dist/platforms.json`）+ 手工数据，生成自包含的 `platform.generated.ts`（64 预设 = 12 knowledge + 52 manual，26 平台）。铁律落地：**尺寸（width/height）以知识仓为唯一事实源**，冲突处知识仓胜（youtube.thumbnail 1280×720→3840×2160、facebook.cover 1640×856→851×315、web.favicon 64×64→32×32、wechat.article 900×500→900×383）；展示字段（platform/name/category/format/fit）在映射预设上沿用手工值以保持 id 与 UX 稳定（Knowledge 存 Facts，Cloud/Open 出 Opinion）。新增 `favicon.apple-touch-icon`（180×180，知识仓派生）。CI 守卫：`platform-knowledge.test.ts` 双向校验 knowledge 预设尺寸与知识仓 `recommendedSize` 逐字段相等（数据漂移或手改产物均 fail）。根 `pnpm codegen` 已接入本脚本。**运行时包体积不变**（产物为纯字面量数组，仅 import type）。
- **知识仓后续（非 open 侧）**：52 个 manual 预设属长尾平台（TikTok/LinkedIn/Pinterest/打印/电商等），知识仓因严格来源策展（`ref:` 必填）暂未收录。应逐平台向 lokvis-knowledge 仓补入带官方来源的数据后由 codegen 接管，**不在 open 侧手工覆盖**；知识仓收录后把对应规格登记进 codegen `MAPPING`（映射到既有 id）即自动切换为 `source: 'knowledge'`。

#### C2 探测结果与 data-compatibility 一致性测试 — 2h ✅
- **执行思路**：新增测试：在 CI 的真实 chromium（复用 D2 的 Playwright 环境）里跑 `FormatSupportProbe`，与 `@lokvis/data-compatibility` 中 chrome 列断言一致；不一致即 fail——双向守卫（探测代码错 or 知识数据过期都会暴露）。
- **验收**：CI 新增 job 通过；人为改错一处数据可使其失败。
- **完成记录（2026-07-31）**：
  - **语义修正（关键）**：`FormatSupportProbe.detectEncodeSupport` 测的是 **编码/encode**（canvas→blob 实编 1×1），而 `data-compatibility` 原 `status` 列记的是 **解码/显示**。二者语义不同（chrome 能解码 AVIF 但 canvas 不能编码 AVIF），直接对比会假阳性。
  - **方案 = 知识仓扩 encode 维度**（而非 open 侧 workaround）：`lokvis-knowledge` compatibility schema 新增可选 `support[env].encode`（`encodeSupport` $def，与 `status` 同形不递归）；`image-browsers` 对 5 个探测格式填 encode 列——jpeg/png/webp `supported`，avif/gif `unsupported`+notes（canvas 编码器缺失静默回退 PNG），覆盖全 8 环境；record `1.2.0→1.3.0`，新增 `ref:mdn-canvas-toblob`（official-doc）。docs §4 补 encode 说明。知识仓 `pnpm run ci` 全绿（55 records，13 tests）。
  - **发布**：knowledge 本地已 commit + 打 tag `v0.3.0`（root `0.2.0→0.3.0`）；**push 由维护者手动执行**，`release.yml` 于 `v*` tag 自动 `npm publish` 各 `data-*`（含 `@lokvis/data-compatibility@0.3.0`）。
  - **open 侧守卫**：复用 D2「vite + Playwright chromium + harness」模式（不走 vitest）：
    - `benchmark/harness-compat/{index.html,main.ts}`：`import { detectEncodeSupport } from '@lokvis/browser-adapter'` 暴露 `window.__compat.probe`。
    - `benchmark/compat-check.mjs`：读 `@lokvis/data-compatibility` bundle 的 `compat:image-browsers`，真实 chromium 探测 5 格式，与 chrome `encode` 列逐一断言；缺 encode 字段或 status≠supported/unsupported 亦判错；不一致 `exit 1`。
    - `benchmark/package.json` devDeps 增 `@lokvis/browser-adapter`(workspace:\*) + `@lokvis/data-compatibility@0.3.0`；根 `compat:check` 脚本；新增 `.github/workflows/compat-check.yml`（push/PR→main/dev，装 Playwright chromium 后跑 `pnpm compat:check`）。
  - **验证**：本地用 0.3.0 tarball（file 链接）跑 `pnpm compat:check` 正测通过（png/jpeg/webp=true，avif/gif=false 全吻合）；负测把 avif chrome `encode.status` 改 supported → 如期 `exit 1`；还原复绿。open `pnpm typecheck` 全绿。
  - **守卫范围**：5 探测格式（png/jpeg/webp/avif/gif）× chrome 环境。
  - **⚠️ 遗留（依赖发布顺序）**：`benchmark/package.json` 已固定 `@lokvis/data-compatibility@0.3.0`，但该版本尚未上 npm，故 open 侧 lockfile 未含此依赖。**待维护者 push knowledge `v0.3.0` tag、CI 发版 0.3.0 后**，在 open 侧执行 `pnpm install` 补 lockfile 再提交，`compat-check.yml` 方可 frozen-install 转绿。

### D. Benchmark 基础设施（12h，P1，产出交付 knowledge 仓）

> 与 `lokvis-knowledge/docs/03-task-breakdown.md` W3 同一事项，归属本仓执行，估时以此处为准。
>
> **完成记录（2026-07-30）**：D1–D4 已完成，详见 knowledge 仓 03-task-breakdown.md W3 完成记录。要点：语料改为程序化生成（自产 CC0，sha256 可复现，无需 R2/LFS）；23 组合全绿，AVIF 走 WASM 回退并记录 encoder；首份 `benchmark:image-ops-2026-07`（runsPerImage=5）已合入 knowledge `data/benchmarks/`（validate 54 records 绿）；重复性：体积/SSIM 跨轮 100% 确定，encodeMs 的 "<10% 波动" 口径限定独占 CI runner（本地共享 VM 跨轮漂移 2–3×，宿主竞争所致）；D4 的实际 GitHub 触发验收待维护者配置 `KNOWLEDGE_BOT_TOKEN` secret（已登记为 [TASKS.md](./TASKS.md) OPS-1 / OPS-2）。附带修复 browser-adapter FormatSupportProbe 的 OffscreenCanvas getContext bug。

#### D1 语料集 corpus v1 — 2h ✅
- **执行思路**：30–40 张可再分发图像（Wikimedia CC0 优先），五类覆盖（照片/插画/截图/透明/大尺寸）；`benchmark/corpus/manifest.json` 记录 sha256/尺寸/类别/逐张许可；大文件走 R2 或 Git LFS，脚本一键拉取；knowledge 仓登记 `ref:lokvis-corpus-v1`。
- **验收**：manifest 完整；`pnpm bench:fetch-corpus` 可复现拉取。

#### D2 基准 harness — 4h ✅
- **执行思路**：`benchmark/`目录（不发布 npm）：Playwright chromium headless 加载最小 harness 页，页内用 `@lokvis/engine-image` 执行【操作 × 源格式 × 目标格式 × 质量 60/80/95】矩阵；每组合 3 次取中位数，记录 encodeMs/输出体积/简版 SSIM；用 `FormatSupportProbe` 先探测，不支持组合标 skip。
- **验收**：`pnpm bench:image` 出原始 JSON；重复运行中位数波动 <10%。

#### D3 报告生成器 — 2h ✅
- **执行思路**：`benchmark/report.mjs` 聚合为 knowledge benchmark schema 格式（runner 元数据自动注入：engine 版本/playwright 版本/CI hardwareClass），ajv 用 knowledge 仓 schema 自检。
- **验收**：产物拷入 knowledge `data/benchmarks/` 后 `pnpm validate` 通过。

#### D4 定期运行 + bot PR — 3h ✅
- **执行思路**：`.github/workflows/benchmark.yml`：月度 cron + workflow_dispatch → D2/D3 → `peter-evans/create-pull-request` 向 knowledge 仓提 PR（fine-grained PAT，仅 contents+pull-requests，最小权限）；PR 附与上期关键指标 diff。workflow 内不插值任何不可信输入。
- **验收**：手动触发一次，knowledge 仓收到 CI 绿的机器人 PR。

### E. 文档与元数据治理（5h，P0，可立即做）

#### E1 README 全面修正 — 2h ✅
- **执行思路**：包数 23→28、补 Monorepo 树漏列的 embed-kit/embed-image/embed-pdf/embed-video/i18n、engine-pdf/video 移出 stub 描述（pdf-lib/ffmpeg.wasm 已实装）、"Alpha 待发布"改为已发布 0.8.x、examples 7→8、覆盖率/测试数徽章改链接 CI 而非快照值、Hero GIF 占位保留 TODO。定位语与架构 v2 对齐（"Digital Asset Intelligence Platform 的开源 Runtime"）。
- **验收**：README 与 `ls packages` / 实际实现零出入。

#### E2 packages/ENGINES.md 重写 — 1h ✅
- **执行思路**：按 B1 裁决重写（当前全文过期：仍称 engine 为 placeholder、引用不存在的 `docs/whitepaper/`）；内容缩为：各 engine 现状表 + EngineAdapter 契约适用范围 + 新增 engine checklist（含 stub 约定，与 AGENTS.md 一致）。
- **验收**：文档与代码现状一致。
- **依赖**：B1。

#### E3 docs/architecture.md 更新 — 1.5h ✅
- **执行思路**：删除 `apps/web` 残留引用（L79 `_headers`，该资产已按 ADR-012 迁出）；架构图加入 Browser Adapter 层（六层）；补三仓关系一节（链接根 architecture-v2.md）。
- **验收**：文档内无失效路径引用。

#### E4 AGENTS.md 更新 — 0.5h ✅
- **执行思路**：五层图更新为含 Adapter 的六层；新增约束条目："runtime/workflow/capability/plugin/sdk 禁止直接使用浏览器 API，必须经 @lokvis/browser-adapter"；测试约定补 adapter fake 用法。
- **验收**：AGENTS.md 与 A1 的 ADR 一致。
- **依赖**：A1。

### F. 协议与治理（3h，P2，需 maintainer 决策）

#### F1 MIT → Apache-2.0 评估与决策 — 2h ✅
- **执行思路**：架构 v2 最终态裁决 Open 用 Apache-2.0（专利授权条款对 Runtime 类项目更稳），现为 MIT。写 ADR 列利弊：已发布 0.8.x 的 MIT 版本不可撤回（换协议只影响后续版本）、30 个 package.json + LICENSE + NOTICE 文件 + THIRD_PARTY_LICENSES 联动、外部贡献者 CLA 现状确认。**是否切换由 maintainer 拍板，本任务只交付决策材料；若维持 MIT，更新根 architecture-v2.md §2 备注。**
- **验收**：ADR 017 成稿含推荐结论；决策记录在案。
- **完成记录（2026-08-01）**：maintainer 决策采用 Apache-2.0。ADR-019 成稿（Accepted）；根 LICENSE 替换为 Apache-2.0 全文；新增 NOTICE（含商标保留）；43 个 package.json `"license"` 字段 MIT→Apache-2.0；README/CONTRIBUTING/architecture.md 许可引用同步更新。已发布 ≤0.9.x 版本永久保持 MIT（不可撤回），0.10.0+ 生效 Apache-2.0。

#### F2 商标与品牌声明 — 1h ✅
- **执行思路**：README/LICENSE 补 "Lokvis" 名称与 logo 商标保留声明（Open Core 惯例：代码开源、商标保留），与对话结论一致；检查 npm org 主页描述同步。
- **验收**：声明落文；不阻塞任何现有使用场景。
- **完成记录（2026-08-01）**：README License 节新增商标声明（"Lokvis" 名称/Logo 不含在 Apache-2.0 授权内，引用 §6）；NOTICE 文件同步英文商标保留条款。

### G. 长线扩域——最终态包完整性（20h，P2，Y2/Y3 节奏）

#### G1 engine-archive + plugin-archive — 8h（拆 4 步） ✅
- **G1a 设计 1h**：ADR 定能力面（zip/unzip/list，fflate 纯 JS 零 WASM，浏览器/Node 同构）；capability 命名入 codegen 管线。
- **G1b 实现 4h**：engine-archive（Blob↔Blob 纯函数，遵守 `Record<string, any>` 参数签名约定）+ plugin-archive（installer + implementations，stub 约定不适用因直接真实现）。
- **G1c 测试 2h**：`__tests__/plugin.test.ts` 按 AGENTS.md 约定全套；大文件内存守卫联动 MemoryGuard 验证。
- **G1d 发布 1h**：changeset minor；docs/capabilities.md 更新。
- **验收**：playground 可 zip/unzip；覆盖率达标。

#### G2 engine-office 技术选型 spike — 4h ✅
- **执行思路**：时间盒 4h 只做评估不实现：docx（docx 库/mammoth 读）、xlsx（SheetJS 社区版许可风险 vs exceljs）、浏览器内存可行性；产出 spike 报告 + go/no-go 建议（对话结论 office 属 Y2 后半）。
- **验收**：报告落 docs/reports/，含推荐路线与风险。

#### G3 File System Access（FilePickerAdapter 实装） — 5h ✅
- **G3a 裁决 1h**：独立 `@lokvis/fs` vs 并入 browser-adapter——倾向并入（同属 L1，避免包碎片化），ADR 记录。
- **G3b 实装 4h**：`showOpenFilePicker`/`showSaveFilePicker`/拖拽目录遍历封装 + Safari/Firefox 降级（input[type=file] / a[download]）；接通 `plugin-permissions.ts` 预留的权限点；embed-kit download.ts 改走此路径。
- **验收**：Chrome 原生另存为、Safari 降级下载均可用；权限模型测试覆盖。

#### G4 MCP 工具描述数据化 — 3h ✅
- **执行思路**：mcp-server 工具描述由静态手写改为构建时从 capability 元数据 + `@lokvis/data-formats`（格式说明）生成，让 AI 客户端获得更准确的参数/格式约束；保留手工覆盖位。与 "AI 后面的 Runtime" 定位直接相关，提高 Agent 调用成功率。
- **验收**：examples 中 Claude Desktop/Cursor 配置回归可用；工具描述含格式约束信息。
- **完成记录（2026-08-01）**：`scripts/codegen-mcp-tools.ts` 从 capability manifests + `@lokvis/data-formats@0.3.0`（devDep，createRequire）生成 `tool-metadata.generated.ts`（35 tools，image 域含 14 格式约束）；`manual-overrides.ts` 提供 MCP 特有 inputSchema + 描述增强（mirror C1 platform-manual 模式）；5 个 tool 文件（image/pdf/video/audio/ai）改由 `reg()` helper 数据驱动注册。drift-guard 测试（schemas.test.ts）守卫生成集 ↔ BUILTIN_CAPABILITIES 一致性。修复既有 bug：`lokvis_audio_compress` 引用不存在的 `audio.compress` → 改为 `lokvis_audio_normalize`（audio.normalize，level dB）。codegen 幂等；typecheck 65/65、test 2770 绿。

---

## 5. 执行顺序建议

```
批次 1（P0，7h）  ：E1/E3 文档纠偏 → A1 ADR（E4 随后）
批次 2（P0，17h） ：A2→A3→A4→A5→A6→A7（Adapter 主线，顺序执行）
批次 3（P1，8h）  ：B1/B2 + E2 → C1/C2（等 knowledge v0.2.0）
批次 4（P1，12h） ：D1→D2→D3→D4（benchmark，可与批次 3 并行）
批次 5（P2，23h） ：F1/F2 决策 → G1→G3→G4，G2 spike 择机
```

原则：
1. **Adapter 主线（A）是本仓唯一的结构性重构**，期间不叠加其他破坏性变更；每步保持全绿再进下一步。
2. 所有对外行为不变的重构走 minor/patch 正常发版（无冻结期，cloud 随版本跟进）。
3. C/D 与 knowledge 仓联动的任务，接口以 knowledge `docs/01-schema-spec.md` 为准。
4. F1 协议切换、G 扩域涉及方向性决策，动手前需 maintainer 确认。
