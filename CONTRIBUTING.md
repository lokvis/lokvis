# 贡献指南(Contributing to Lokvis)

感谢你对 Lokvis 的兴趣!这是一个 **Local-first 浏览器工作区平台**,所有处理在浏览器中完成,文件不离开设备。本文档说明如何参与贡献。

> **TL;DR**:Fork → 分支 → `pnpm install` → `pnpm test:fast && pnpm typecheck` → Conventional Commits → PR 到 `dev` 分支。

## 目录

- [行为准则](#行为准则)
- [环境要求](#环境要求)
- [初次启动](#初次启动)
- [架构约束(必读)](#架构约束必读)
- [代码风格](#代码风格)
- [测试约定](#测试约定)
- [提交规范(Conventional Commits)](#提交规范conventional-commits)
- [分支命名](#分支命名)
- [Pull Request 流程](#pull-request-流程)
- [Issue 报告](#issue-报告)
- [License 贡献](#license-贡献)

---

## 行为准则

参与本项目即代表你同意遵守 [Code of Conduct](CODE_OF_CONDUCT.md)。请在所有交流中保持友善、包容、对事不对人。中文 / 英文均可,技术术语保留英文。

---

## 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | `>=22.12.0` | 见 `package.json` engines |
| pnpm | `>=9.0.0`(`pnpm@9.12.0`) | 包管理器,版本由 `packageManager` 字段锁定 |
| Git | `>=2.40` | 需要 Conventional Commits 支持 |

> 强烈建议用 [corepack](https://nodejs.org/api/corepack.html) 启用 pnpm:
> ```bash
> corepack enable
> corepack prepare pnpm@9.12.0 --activate
> ```

浏览器:开发环境需 **Chromium 内核**(Chrome / Edge / Brave),Safari / Firefox 可运行但有降级提示(见 `apps/playground/src/components/pwa/BrowserSupportBanner.tsx`)。

---

## 初次启动

```bash
# 1. Fork & Clone
git clone https://github.com/<your-username>/lokvis.git
cd lokvis
git remote add upstream https://github.com/lokvis/lokvis.git

# 2. 安装依赖(monorepo,根目录一次性装齐)
pnpm install

# 3. 构建 @lokvis/* 子包(playground / docs 依赖其 dist 产物)
pnpm build

# 4. 启动 playground(端口 5601)
pnpm --filter @lokvis/playground dev

# 5. 启动文档站(端口 4321,可选)
pnpm --filter @lokvis/docs dev
```

验证环境就绪:

```bash
pnpm test:fast     # 单元测试(无覆盖率,快速)
pnpm typecheck     # turbo 全量类型检查
pnpm lint          # oxlint
```

---

## 架构约束(必读)

Lokvis 是严格的**五层架构**,单向依赖,**禁止跨层引用**:

```
UI → Workflow → Runtime → Capability → Engine
```

- **UI**(`@lokvis/ui-react` / `apps/playground`)渲染 Workspace
- **Workflow**(`@lokvis/workflow`)构造工具,仅依赖 `@lokvis/schema`
- **Runtime**(`@lokvis/runtime`)调度 Capability,不依赖任何 Engine
- **Capability**(`plugin-*`)是 Engine 与 Runtime 的桥梁
- **Engine** 只做 Blob ↔ Blob 纯函数,不感知 Asset/Workflow
- **Schema**(`@lokvis/schema`)是最底层稳定核心,所有层可依赖

详细规则(类型签名 / Stub Engine / fetch 校验 / EventBus 安全 / File 构造等)见 [AGENTS.md](AGENTS.md)。**人类贡献者同样适用**,提交前请通读。

关键红线:

1. **Engine 函数签名用 `Record<string, any>`,不用具体 interface** —— 避免上游 `as unknown as` 双断言
2. **禁止 `as unknown as` 双断言**(Worker scope 等跨边界场景例外)
3. **所有 `fetch()` 必须检查 `response.ok`**
4. **EventBus `emit()` 遍历 `[...set]` 副本 + try/catch 包裹每个 handler**
5. **File 对象用 `new File([blob], name, { type })`**,不要展开 Blob

---

## 代码风格

- **Linter**:`oxlint`(配置见 `.oxlintrc.json`)。提交前 `pnpm lint`,可自动修复用 `pnpm lint:fix`
- **Formatter**:`prettier`(配置见 `.prettierrc.json`,Astro 文件用 `prettier-plugin-astro`,Tailwind 类用 `prettier-plugin-tailwindcss`)
- **TypeScript**:`strict` 模式,所有 PR 必须通过 `pnpm typecheck`
- **导入顺序**:外部包 → `@lokvis/*` → `@/`(playground alias)→ 相对路径

---

## 测试约定

| 类型 | 框架 | 位置 | 运行命令 |
|---|---|---|---|
| 单元测试 | Vitest(`globals: false`,显式 import) | `packages/**/src/__tests__/*.test.ts` | `pnpm test:fast` |
| 组件测试 | Vitest + jsdom(注释切换) | `apps/playground/src/**/*.test.ts(x)` | `pnpm test:fast` |
| 覆盖率 | `@vitest/coverage-v8` | — | `pnpm test:coverage` |
| E2E | Playwright(Chromium) | `apps/playground/tests/e2e/*.spec.ts` | `pnpm --filter @lokvis/playground test:e2e` |

约定:

- **中文测试描述**:`test('压缩 PNG 应返回更小的 Blob', ...)`
- **浏览器 API**(Canvas / OPFS / IndexedDB)用 fake 实现,不依赖真实环境
- **覆盖率门槛**:lines 60%+,branches 75%+(见 `vitest.config.ts` thresholds)
- **核心包**(runtime / schema / capability / engine-image / plugin-*)必须有测试覆盖
- **新增 plugin-* 包**必须包含 `__tests__/plugin.test.ts`:覆盖插件常量、installer 注册数、`buildXxxCapabilityImplementations` 返回数、stub status、execute 抛错

E2E 测试细节见 [`apps/playground/tests/e2e/`](apps/playground/tests/e2e/)。

---

## 提交规范(Conventional Commits)

所有提交必须遵循 [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(runtime): add new capability 'image.filter'"
git commit -m "fix(ui-react): Canvas useEffect deps missing canCompare"
git commit -m "docs(w23.2): add CONTRIBUTING.md"
git commit -m "test(engine-image): add try/finally for bitmap.close"
```

类型(7 种):

| 类型 | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `refactor` | 重构(不改变行为) |
| `test` | 测试相关 |
| `chore` | 构建 / 工具链 / 杂项 |
| `perf` | 性能优化 |

scope 用包名或周次任务编号(如 `runtime` / `ui-react` / `w23.2`)。

---

## 分支命名

```bash
git checkout -b feat/your-feature     # 特性
git checkout -b fix/your-bugfix       # 修复
git checkout -b docs/your-docs        # 文档
git checkout -b refactor/your-refactor
```

分支名小写,用 `/` 分隔类型与描述,描述用 kebab-case。

---

## Pull Request 流程

1. **从 `dev` 分支拉新分支**(不要直接在 `main` / `dev` 上提交)
2. **写代码 + 测试**,确保:
   - `pnpm typecheck` 通过
   - `pnpm test:fast` 通过
   - `pnpm lint` 无 error(警告可酌情保留)
   - 新功能必须配测试
3. **提交 + 推到 fork**:
   ```bash
   git push origin feat/your-feature
   ```
4. **向 `dev` 分支发起 PR**(不是 `main`!)
5. **PR 标题遵循 Conventional Commits**(如 `feat(runtime): 支持 image.filter 滤镜`)
6. **填写 PR 模板**(见 [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)):
   - 变更说明
   - 验证方式(typecheck / test / build)
   - Breaking changes(如有)
   - 关联 Issue(如 `Closes #123`)
7. **CI 必须全绿**(lint + typecheck + build + test)
8. **至少 1 位 maintainer 批准**后合并(默认 squash merge)

### PR 大小

- 单个 PR 控制在 **~500 行 diff** 以内(不含 lockfile / 生成代码)
- 大重构拆成多个 PR,每个独立可合并
- 每个 PR 应该是**单一职责**(一个功能 / 一个 bug / 一类重构)

---

## Issue 报告

提交 Issue 前请:

1. **搜索现有 Issue**,避免重复
2. **用对应模板**:
   - Bug:[Bug Report 模板](.github/ISSUE_TEMPLATE/bug_report.yml)
   - 新功能:[Feature Request 模板](.github/ISSUE_TEMPLATE/feature_request.yml)
3. **提供复现步骤**(Bug)或使用场景(Feature)
4. **不要在 Issue 中粘贴真实用户文件 / API token / Sentry DSN**

隐私相关:如果 Bug 涉及具体文件内容,用一张 256×256 纯色 PNG 复现即可,不要上传用户真实图片。

---

## License 贡献

提交 PR 即代表你同意以 [Apache-2.0 License](LICENSE) 授权你的贡献给 Lokvis 项目。我们**不要求** DCO / CLA,但请确保:

- 你拥有提交内容的版权(自己写的,或有明确授权)
- 引入第三方代码必须保留原始 license 头并在 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) 登记
- **GPL / AGPL 代码禁止引入**主 bundle(可在 Worker 隔离边界内使用,见 [ADR-012](docs/adr/012-商业资产迁出.md))

第三方依赖 license 审计见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md),Phase 1 仅允许 MIT / Apache-2.0 / BSD / ISC 等 permissive license。

---

## 联系方式

- **Issue**:GitHub Issues(首选)
- **Discord**:社区频道(待 W23.8 搭建,届时此处更新链接)
- **邮件**:hello@lokvis.dev(仅商务 / 安全报告)

安全问题请**私下邮件**报告,不要公开 Issue。

---

<p align="center">
  <sub>再次感谢你的贡献!Local-first, privacy-first, open-source.</sub>
</p>
