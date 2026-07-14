# Docs 部署文档

Lokvis 文档站部署在独立子域名 **docs.lokvis.dev**,托管于 Cloudflare Pages。
项目名 `lokvis-docs`,根路径部署(`base: '/'`)。

本文件覆盖从 0 到上线的一次性配置、日常部署流程、本地预览、故障排查。

---

## §1 前置条件

1. **Cloudflare 账号**:拥有 lokvis 组织的 Cloudflare 账号访问权限。
2. **Cloudflare Pages 项目**:已创建名为 `lokvis-docs` 的 Pages 项目(见 §2)。
3. **API Token**:拥有以下权限的 Cloudflare API Token:
   - `Account → Cloudflare Pages → Edit`
   - `Account → Account Settings → Read`
4. **Account ID**:在 Cloudflare dashboard 右下角找到 Account ID。
5. **GitHub Secrets**:仓库 Settings → Secrets and variables → Actions 已配置:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

> Playground 与 Docs 共用同一组 GitHub Secrets(同一 API Token 有 Pages Edit 权限)。

---

## §2 一次配置(仅做一次)

### 2.1 Pages 项目(已创建)

Pages 项目 `lokvis-docs` 已通过 API 创建:

| 字段 | 值 |
|---|---|
| Project name | `lokvis-docs` |
| pages.dev 子域名 | `lokvis-docs.pages.dev` |
| Production branch | `dev` |

首次部署由 GitHub Actions 接管(见 §3)。

> 不要配置 Cloudflare Pages 自带的 "Git integration"(构建命令)——
> 构建在 GitHub Actions 里跑(见 §3),Pages 只接收 `wrangler pages deploy` 推送的产物。

### 2.2 绑定 custom domain(待 lokvis.com zone 添加后执行)

> **当前状态**:`lokvis.com` 域名尚未添加到当前 Cloudflare 账户的 zones。
> 在添加 zone 前,文档站通过 `lokvis-docs.pages.dev` 访问。
> 添加 zone 后,按以下步骤绑定 custom domain。

**步骤 1:添加 lokvis.com zone**

Cloudflare dashboard → Add a site → 输入 `lokvis.com` → 选择 Free plan →
按提示在域名注册商处修改 nameservers 为 Cloudflare 提供的 NS。

**步骤 2:绑定 custom domain**

在 `lokvis-docs` 项目 → Custom domains → Set up a custom domain:
- 输入 `docs.lokvis.dev`
- Cloudflare 自动添加 CNAME 记录(指向 `lokvis-docs.pages.dev`)
- 等待证书签发(通常 1-5 分钟),状态变 Active

> 若 `lokvis.dev` 域名也在 Cloudflare 管理,DNS 配置全自动;
> 若域名在其他注册商,需手动添加 CNAME:`docs → lokvis-docs.pages.dev`。

### 2.3 配置 GitHub Secrets

仓库 lokvis/lokvis → Settings → Secrets and variables → Actions → New repository secret:
- `CLOUDFLARE_API_TOKEN` = 在 https://dash.cloudflare.com/profile/api-tokens 创建的 token(权限见 §1)
- `CLOUDFLARE_ACCOUNT_ID` = dashboard 右下角的 Account ID

---

## §3 部署流程

部署由 `.github/workflows/deploy-docs.yml` 驱动。

### 3.1 自动部署

push 到 `dev` 分支且 `apps/docs/**` 或 `packages/*/src/**` 路径下有文件变更时,自动触发:
1. checkout 代码
2. pnpm 9.12.0 + Node 24 安装依赖
3. `pnpm build`(全量构建,因为 docs 的 TypeDoc API Reference 依赖 `@lokvis/*` 子包的 dist)
4. `cloudflare/wrangler-action@v3` 把 `apps/docs/dist` 推送到 `lokvis-docs` Pages 项目

`dev` 分支推送 = production 部署。

### 3.2 手动部署

GitHub → Actions → Deploy Docs → Run workflow → 选择 `dev` 分支 → Run。

### 3.3 并发控制

`concurrency: deploy-docs, cancel-in-progress: false`——
部署不取消进行中的旧运行,避免半成品上线。新部署排队等待当前部署完成。

---

## §4 本地预览

```bash
# 在仓库根目录
pnpm --filter @lokvis/docs dev       # dev server
pnpm --filter @lokvis/docs build     # 构建到 dist/
pnpm --filter @lokvis/docs preview   # 预览构建产物
```

---

## §5 故障排查

### 5.1 构建产物路径错误(404)

**症状**:访问 `docs.lokvis.dev` 白屏,Console 报 404。

**原因**:`astro.config.mjs` 的 `base` 配置错误。

**预期**:`base: '/'`,构建产物在 `apps/docs/dist/` 根目录。

### 5.2 TypeDoc API Reference 生成失败

**症状**:build 阶段报 TypeDoc 错误。

**排查**:
1. 确认 `pnpm build` 全量执行(先构建 @lokvis/* 子包再构建 docs)
2. 检查 `packages/*/src` 下的 TypeScript 源码是否有类型错误
3. TypeDoc 配置在 `apps/docs/astro.config.mjs` 的 `starlightTypeDoc` 插件

### 5.3 Custom domain DNS 未生效

**症状**:访问 `docs.lokvis.dev` 报 DNS_PROBE_FINISHED_NXDOMAIN。

**排查**:
1. `dig docs.lokvis.dev` 确认有 CNAME 解析到 `lokvis-docs.pages.dev`
2. Cloudflare dashboard → DNS → 确认 CNAME 记录存在
3. 证书签发需 1-5 分钟,未完成时浏览器报 SSL 错误

### 5.4 部署 workflow 失败

**常见原因**:
- `CLOUDFLARE_API_TOKEN` 权限不足 → 检查 token 是否有 `Pages → Edit` 权限
- `CLOUDFLARE_ACCOUNT_ID` 错误 → dashboard 右下角核对
- 子包未构建 → workflow 跑 `pnpm build`(全量),不应跳过

---

## §6 相关文件清单

| 文件 | 作用 |
|---|---|
| `apps/docs/astro.config.mjs` | Astro 配置:site=`docs.lokvis.dev`,base=`/`,Starlight + TypeDoc |
| `apps/docs/public/_headers` | Cloudflare Pages 安全头 + 缓存策略 |
| `apps/docs/DEPLOY.md` | 本文件 |
| `.github/workflows/deploy-docs.yml` | GitHub Actions 部署 workflow(dev 分支自动 + workflow_dispatch 手动) |
