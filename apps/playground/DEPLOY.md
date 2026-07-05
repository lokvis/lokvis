# Playground 部署文档

Lokvis Playground 部署在独立子域名 **playground.lokvis.dev**，托管于 Cloudflare Pages。
项目名 `lokvis-playground`，根路径部署（`base: '/'`，不再是 `lokvis.com/playground` 子路径）。

本文件覆盖从 0 到上线的一次性配置、日常部署流程、本地预览、环境变量、故障排查。

---

## §1 前置条件

1. **Cloudflare 账号**：拥有 lokvis 组织的 Cloudflare 账号访问权限。
2. **Cloudflare Pages 项目**：已创建名为 `lokvis-playground` 的 Pages 项目（见 §2）。
3. **API Token**：拥有以下权限的 Cloudflare API Token：
   - `Account → Cloudflare Pages → Edit`
   - `Account → Account Settings → Read`
4. **Account ID**：在 Cloudflare dashboard 右下角找到 Account ID。
5. **GitHub Secrets**：仓库 Settings → Secrets and variables → Actions 已配置：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

---

## §2 一次配置（仅做一次）

### 2.1 创建 Pages 项目

在 Cloudflare dashboard → Workers & Pages → Create → Pages → Upload assets 创建项目：
- **Project name**: `lokvis-playground`
- **Production branch**: `dev`
- 项目首次创建可上传任意占位 zip，正式部署由 GitHub Actions 接管。

> 不要配置 Cloudflare Pages 自带的 "Git integration"（构建命令）——
> 构建在 GitHub Actions 里跑（见 §3），Pages 只接收 `wrangler pages deploy` 推送的产物。

### 2.2 绑定 custom domain

在 `lokvis-playground` 项目 → Custom domains → Set up a custom domain：
- 输入 `playground.lokvis.dev`
- Cloudflare 自动添加 CNAME 记录（指向 `<project>.pages.dev`）
- 等待证书签发（通常 1-5 分钟），状态变 Active

> 若 `lokvis.dev` 域名也在 Cloudflare 管理，DNS 配置全自动；
> 若域名在其他注册商，需手动添加 CNAME：`playground → lokvis-playground.pages.dev`。

### 2.3 配置 GitHub Secrets

仓库 lokvis/lokvis → Settings → Secrets and variables → Actions → New repository secret：
- `CLOUDFLARE_API_TOKEN` = 在 https://dash.cloudflare.com/profile/api-tokens 创建的 token（权限见 §1）
- `CLOUDFLARE_ACCOUNT_ID` = dashboard 右下角的 Account ID

---

## §3 部署流程

部署由 `.github/workflows/deploy-playground.yml` 驱动。

### 3.1 自动部署

push 到 `dev` 分支且 `apps/playground/**` 路径下有文件变更时，自动触发：
1. checkout 代码
2. pnpm 9.12.0 + Node 22 安装依赖
3. `pnpm build`（全量构建，因为 playground 依赖 `@lokvis/*` 子包的 dist）
4. `cloudflare/wrangler-action@v3` 把 `apps/playground/dist` 推送到 `lokvis-playground` Pages 项目

`dev` 分支推送 = production 部署。

### 3.2 手动部署

GitHub → Actions → Deploy Playground → Run workflow → 选择 `dev` 分支 → Run。
用于：构建配置变更后强制重新部署、Cloudflare 侧回滚后重新推送。

### 3.3 并发控制

`concurrency: deploy-playground, cancel-in-progress: false`——
部署不取消进行中的旧运行，避免半成品上线。新部署排队等待当前部署完成。

---

## §4 本地预览

```bash
# 在仓库根目录
pnpm --filter @lokvis/playground dev       # dev server，端口 5601
pnpm --filter @lokvis/playground build     # 构建到 dist/
pnpm --filter @lokvis/playground preview   # 预览构建产物
```

### COOP/COEP 头

image engine 需要 `SharedArrayBuffer`，要求页面有 `Cross-Origin-Opener-Policy: same-origin`
+ `Cross-Origin-Embedder-Policy: require-corp` 头。

- **dev server**：`astro.config.mjs → vite.server.headers` 已配置，dev 模式自动生效。
- **preview**：`astro preview` 默认不发 `_headers`，本地 preview 时 SharedArrayBuffer 不可用。
  若需测试 COOP/COEP，用 `npx wrangler pages dev dist`（自动读 `_headers`）。

---

## §5 环境变量

所有变量均为可选，未配置时 playground 退化为 no-op 模式。

| 变量 | 说明 | 默认 |
|---|---|---|
| `PUBLIC_SENTRY_DSN` | Sentry DSN，未配置则 Sentry 完全不上报 | 空（no-op） |
| `PUBLIC_SENTRY_RELEASE` | Sentry release 标签 | `playground@0.1.0` |

在 Cloudflare Pages 项目 → Settings → Environment variables（Production）配置。
构建期 Astro 把 `PUBLIC_*` 内联到客户端 bundle，部署后修改需重新跑 workflow。

参考 `apps/playground/.env.example`。

---

## §6 故障排查

### 6.1 SharedArrayBuffer is undefined

**症状**：image engine 抛 `SharedArrayBuffer is not defined`。

**原因**：COOP/COEP 头未生效。

**排查**：
1. 打开 DevTools → Network → 点击主文档请求 → Response Headers
2. 确认有 `cross-origin-opener-policy: same-origin` 和 `cross-origin-embedder-policy: require-corp`
3. 若缺失：检查 `apps/playground/public/_headers` 是否在构建产物 `dist/_headers` 里
4. Cloudflare Pages 头规则按定义顺序匹配，`/*` 在最后（见 `_headers`）

### 6.2 COOP/COEP 头存在但仍报错

**原因**：页面加载了跨域资源（图片、脚本）未带 `Cross-Origin-Resource-Policy` 头，
导致 COEP 阻止加载。

**排查**：DevTools Console 会有 `NotSameOriginAfterDefaultedToCorp` 报错。
确认所有跨域资源 CDN 都返回 `Cross-Origin-Resource-Policy: cross-origin`（或 same-site）。

### 6.3 构建产物路径错误（404）

**症状**：访问 `playground.lokvis.dev` 白屏，Console 报 404 加载 `/playground/_astro/...`。

**原因**：`astro.config.mjs` 的 `base` 配置错误。

**预期**：`base: '/'`，构建产物在 `apps/playground/dist/` 根目录（不是 `dist/playground/`）。
所有资源 URL 应为 `/_astro/...`，不是 `/playground/_astro/...`。

### 6.4 Custom domain DNS 未生效

**症状**：访问 `playground.lokvis.dev` 报 DNS_PROBE_FINISHED_NXDOMAIN。

**排查**：
1. `dig playground.lokvis.dev` 确认有 CNAME 解析到 `lokvis-playground.pages.dev`
2. Cloudflare dashboard → DNS → 确认 CNAME 记录存在且为 DNS only（灰云）或 Proxied（橙云）均可
3. 证书签发需 1-5 分钟，未完成时浏览器报 SSL 错误

### 6.5 部署 workflow 失败

**常见原因**：
- `CLOUDFLARE_API_TOKEN` 权限不足 → 检查 token 是否有 `Pages → Edit` 权限
- `CLOUDFLARE_ACCOUNT_ID` 错误 → dashboard 右下角核对
- 子包未构建 → workflow 跑 `pnpm build`（全量），不应跳过

---

## §7 相关文件清单

| 文件 | 作用 |
|---|---|
| `apps/playground/astro.config.mjs` | Astro 配置：site=`playground.lokvis.dev`，base=`/`，COOP/COEP dev headers |
| `apps/playground/public/_headers` | Cloudflare Pages 安全头 + 缓存策略（COOP/COEP + immutable assets） |
| `apps/playground/public/_redirects` | Cloudflare Pages SPA fallback（深层路径 → 对应 index.html） |
| `apps/playground/public/manifest.webmanifest` | PWA Web App Manifest（W15.1）—— 应用名、图标、shortcuts、display 模式 |
| `apps/playground/public/icon.svg` | PWA 矢量图标（W15.1）—— indigo→purple 渐变 ◆ 品牌 mark，512×512 |
| `apps/playground/public/sw.js` | Service Worker（W15.1）—— 预缓存 shell + 运行时策略（network-first 导航 / SWR 静态资产） |
| `apps/playground/DEPLOY.md` | 本文件 |
| `.github/workflows/deploy-playground.yml` | GitHub Actions 部署 workflow（dev 分支自动 + workflow_dispatch 手动） |
| `apps/playground/.env.example` | 环境变量示例（PUBLIC_SENTRY_DSN / PUBLIC_SENTRY_RELEASE） |

---

## §8 PWA 图标生成（部署前必做）

`manifest.webmanifest` 引用了 4 个图标，其中 PNG 图标暂未提交到仓库（`public/` 目录只有 `icon.svg`）。
**首次部署前必须手动生成 3 个 PNG 文件**，否则 Chrome 会报 console warning（不阻塞 SW 注册和核心 PWA 功能，但安装到桌面时图标缺失）。

### 8.1 需要生成的文件

| 文件名 | 尺寸 | purpose | 说明 |
|---|---|---|---|
| `icon-192.png` | 192×192 | any | 标准 PWA 图标（home screen） |
| `icon-512.png` | 512×512 | any | 高分辨率 PWA 图标（splash screen） |
| `icon-maskable-512.png` | 512×512 | maskable | Android 自适应图标（需 safe zone padding） |

文件名必须严格匹配上表，放到 `apps/playground/public/` 目录。

### 8.2 生成方法（任选其一）

**方法 A：Figma / Sketch 导出**
1. 打开 `apps/playground/public/icon.svg`（◆ 品牌色 indigo→purple 渐变）
2. 分别导出 192×192、512×512 PNG（背景不透明，用 `#09090b`）
3. maskable 版本：在 512×512 画布外加 10% padding（safe zone），即把图标内容缩到中心 80% 区域，外围填充 `#09090b`
4. 文件名按上表命名，放到 `apps/playground/public/`

**方法 B：`npx @squoosh/cli` 命令行**
```bash
cd apps/playground/public
# 192×192
npx @squoosh/cli --resize '{width:192,height:192}' --png '{}' icon.svg -o icon-192.png
# 512×512
npx @squoosh/cli --resize '{width:512,height:512}' --png '{}' icon.svg -o icon-512.png
# maskable 需手动加 padding，建议用方法 A 或 sharp 脚本
```

**方法 C：临时 sharp 脚本**
仓库 `package.json` 已包含 `sharp` 依赖，可写一次性脚本：
```js
// scripts/gen-icons.mjs（用完即删，不入库）
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile('public/icon.svg');
await sharp(svg).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(svg).resize(512, 512).png().toFile('public/icon-512.png');
// maskable: 画 512×512 黑底，中心贴 410×410 图标（≈80% safe zone）
const inner = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#09090b' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png().toFile('public/icon-maskable-512.png');
```

### 8.3 验证

生成后访问 `https://playground.lokvis.dev/manifest.webmanifest` 确认 JSON 有效；
Chrome DevTools → Application → Manifest 应显示所有图标无 warning。
Lighthouse PWA 审计应通过 "Installable" 检查。

> maskable 图标的 safe zone：Android 自适应图标会按设备主题裁剪外层 10%，
> 因此图标核心内容必须位于中心 80% 区域（即 512×512 中 410×410 内）。
