# @lokvis/capability

## 0.5.3

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.3

## 0.5.2

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.2

## 0.5.1

### Patch Changes

- 0.5.1: video ffmpeg.wasm 浏览器引擎实装 + 补全缺失实现

  - engine-video/web: 基于 @ffmpeg/ffmpeg 的浏览器端 7 操作(compress/transcode/trim/merge/extract-audio/to-gif/screenshot)
  - plugin-video/web: 浏览器 plugin 变体(7 capability 全部真实)
  - embed-video: 默认切换到 videoToolsPluginWeb(ffmpeg.wasm 懒加载)
  - mcp-server: 装载 video/audio/ai node plugins + AI tool handlers
  - runtime: OPFS import 实装 + PDF 页数元数据提取
  - cloud-bridge: billing 降级 credits=planQuota
  - ui-react: DownloadPanel 批量下载改用 JSZip

- Updated dependencies []:
  - @lokvis/schema@0.5.1

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.5.0

## 0.4.2

### Patch Changes

- 自 0.4.1 以来的累积发布：

  - feat: Image Workspace Quick Actions 三层架构改造（Headless Hook + 默认 UI + Pipeline 模式）
  - feat: R1 Developer Workspace + S1 CLI 正式发布
  - feat: W21.8 CodeMirror LCP 优化、M1 SSE 生产就绪、W22.6 Playwright E2E
  - fix: 修复 Cloudflare Pages 部署失败（wrangler-action pnpm root 安装报错）

- Updated dependencies []:
  - @lokvis/schema@0.4.2

## 0.4.1

### Patch Changes

- a51d57a: 清理 developer.* codegen 过时注释(Task C 验收后清理):

  - scripts/codegen-capabilities.ts:移除生成模板中"与手写版本逐字段对应;
    W4.3 完成迁移后,手写版本将被删除"的过时注释
    (手写版本已在 PR #28 删除,注释不再适用)
  - scripts/codegen-capabilities.ts:清理 domainToPrefix 中"与手写 developer.ts 一致"
    的过时引用
  - 重新运行 pnpm codegen 同步 6 个 .generated.ts 文件
    (ai/audio/developer/image/pdf/video)

- Phase 2 架构治理收尾 + F1 AI 能力重构 + 统一版本到 0.4.1

  ## P2 优化项（O-8~O-15）
  - engine-image public API 收敛，仅暴露 Blob↔Blob 操作
  - workflow ID 改用 crypto.randomUUID()，添加 MAX_WORKFLOW_STEPS 校验
  - 抽取 buildCapabilityWorkflow 公共辅助消除 90% 重复
  - mcp-server 消除 4 处 .catch(() => {}) 静默吞错
  - mcp-server 删除冗余 as ToolHandler 断言
  - mcp-server 新增 zod schema 运行时校验，消除 7 处 as Parameters<typeof> 断言

  ## P3 深度重构（O-16~O-18）
  - 拆 engine-ai/structured 子路径隔离 Blob→结构化操作（ocr/caption）
  - engine-pdf getPdfInfo 边界张力注释
  - ADR-014 登记 plugin-dev 跨 Engine 层访问 ctx.runtime 例外

  ## F1 AI 能力重构
  - engine-ai 从 Adapter 接口迁移到独立纯函数模式
  - 新增 AiCloudCaller 接口注入模式（不依赖 cloud-bridge）
  - 新增 ai.diagnose-error 能力
  - cloud-bridge 新增 CloudAiClient + ai-client 模块

  ## engine-audio/engine-video 重构
  - 从 Adapter 接口迁移到独立纯函数模式
  - 新增 Node 端 ffmpeg 实装

  ## SDK
  - 新增 plan 维度（free/pro/cloud_pro/enterprise），isPro 为派生字段

  ## 版本统一
  - 配置 changeset fixed 模式，所有 @lokvis/* 包统一版本号
  - 本次释放统一到 0.4.1

- Updated dependencies [a51d57a]
- Updated dependencies
- Updated dependencies [58e7e7f]
  - @lokvis/schema@0.4.1

## 0.2.0

### Minor Changes

- 2aebedb: - 新增 `IMAGE_FILTER` preset(grayscale/invert/sepia/blur),`radius` 参数 `max: 100`
  - `IMAGE_CAPABILITIES` 现包含 9 个能力
- 191877e: W8 预设库 + 工具页打磨(8.1-8.9)——平台预设 + DPI + 目标体积压缩 + 智能格式 + SEO + 隐私声明

  - **capability**:新增 `presets/platform.ts` —— 20+ 平台 63 尺寸预设(YouTube/TikTok/IG/Shopify/Etsy/Twitter/LinkedIn 等),覆盖 social/ecommerce/video/print/other 五大类;4 个辅助函数(`groupPlatformPresetsByCategory` / `groupPlatformPresetsByPlatform` / `findPlatformPreset` / `listPlatforms`)+ 分类标签常量。本地定义 `PlatformFitStrategy` 类型(与 engine-image `FitStrategy` 字面量对齐),避免 capability→engine-image 五层依赖违规
  - **playground·ResizeTool**:接入 `PlatformPresetSelector`,选预设自动填充 width/height/fit;新增 DPI 输入(72/150/300/自定义),作为元数据写入 workflow params(不改变像素尺寸),打印类预设自动 300 DPI,带印刷尺寸 mm 提示
  - **playground·CompressTool**:新增压缩模式切换(质量 / 目标体积),目标体积模式输入 KB,委托 engine 已有 `compressToTargetSize` 二分查找;新增"智能"格式选项(默认),含透明 → PNG 保留 / 否则 → WebP,目标体积模式统一 WebP(PNG 无损无法压到目标)
  - **playground·toolkit**:`PlatformPresetSelector`(按 category 分组 optgroup + 自定义预设命名空间 `custom.` 前缀);`useCustomPresets`(localStorage 持久化 + storage 事件多 tab 同步 + 免费 3 / Pro 无限 + JSON 解析容错);`download.ts#detectTransparency`(canvas + getImageData 扫描 alpha 通道);`PrivacyBadge`(online/offline 事件监听 + 断网验证指引 modal + 离线绿色 "✓ 断网模式 · 仍在工作")
  - **playground·layouts**:新增 `ToolLayout.astro` 包装层 + `tools/seo.ts`(8 工具页 SEO 配置 + `generateOgImage` SVG data URI 1200×630);`BaseLayout.astro` 扩展接受 `description`/`keywords`/`ogTitle`/`ogDescription`/`ogImage`/`ogType` props,emit OG + Twitter Card meta;8 个工具页 .astro 改用 ToolLayout
  - **测试**:新增 37 个单测,全量 660/660 通过
    - `capability/__tests__/platform-presets.test.ts`(22):数据完整性(id 唯一 / 字段必填 / 5 分类非空 / 打印类推荐 PNG)+ 4 辅助函数行为 + 分类标签
    - `engine-image/__tests__/compress-target.test.ts`(15):二分边界 [10,95] 首 mid=52 + 单调性 + 最多 6 轮 + 兜底 quality=10 + best 保留最高满足质量 + 格式参数透传 + bitmap.close 释放 + decode/encode 失败不吞异常

### Patch Changes

- Updated dependencies [2aebedb]
- Updated dependencies [e95976e]
- Updated dependencies [bb5706c]
  - @lokvis/schema@0.2.0

## 0.2.0-beta.0

### Minor Changes

- - 新增 `IMAGE_FILTER` preset(grayscale/invert/sepia/blur),`radius` 参数 `max: 100`
  - `IMAGE_CAPABILITIES` 现包含 9 个能力

### Patch Changes

- Updated dependencies []:
  - @lokvis/schema@0.2.0-beta.0
