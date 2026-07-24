# 能力目录（Capabilities）

> Lokvis 使用 `<domain>.<action>` 命名规范。Runtime 只知 capability，不知具体引擎。

---

## 命名规范

```
<domain>.<action>
```

示例：`image.resize`、`video.transcode`、`pdf.merge`

## 域名空间

| 域名 | 说明 |
|------|------|
| `asset.*` | 跨域资产操作 |
| `image.*` | 图像处理 |
| `video.*` | 视频处理 |
| `audio.*` | 音频处理 |
| `pdf.*` | PDF 操作 |
| `ai.*` | AI 驱动的操作 |
| `developer.*` | 开发者工具（内省、性能分析） |

---

## 内置能力清单

### Image（`@lokvis/plugin-image`，Canvas 引擎）

| 能力 | 说明 | 参数 |
|------|------|------|
| `image.resize` | 调整尺寸 | width, height, fit (cover/contain/fill/inside/outside), dpi |
| `image.compress` | 压缩 | quality (1-100), targetSizeKb, outputFormat |
| `image.convert` | 格式转换 | format (png/jpeg/webp/avif/gif) |
| `image.crop` | 裁剪 | x, y, width, height, aspectRatio |
| `image.rotate` | 旋转 | degrees |
| `image.flip` | 翻转 | direction (horizontal/vertical/both) |
| `image.watermark` | 水印 | text/image, position (9宫格), opacity |
| `image.background` | 背景色 | color |
| `image.filter` | 滤镜预设 | preset (grayscale/invert/sepia/blur), radius (blur 专用，1-100，默认 4) |
| `image.favicon` | 生成多尺寸 ICO favicon | sizes (正方形边长数组，默认 [16,32,48,256]) |

#### 图像编码引擎支持矩阵

所有编码调用点（compress / convert / setBackground / transform 系列 / filter / watermark / tile / targetSize 二分）统一经 `encodeSmart` 分发：**native-first / wasm-fallback**。原生编码器可用走 Canvas 路径；原生不可用且目标为 avif 且 wasm 兜底启用时，分发到 libavif 私有 worker 编码；否则保持既有 throw 语义（上层用 `detectFormatSupport` 门控，避免静默回退 PNG）。

| 格式 | 原生编码（Canvas） | WASM 兜底 | 说明 |
|------|:---:|:---:|------|
| `png` | ✅ 全浏览器 | — | 恒原生支持，短路免探测 |
| `jpeg` | ✅ 全浏览器 | — | 恒原生支持，短路免探测 |
| `webp` | ✅ Chrome / Edge / Firefox / Safari 14+ | — | 无 wasm 兜底；不支持时抛错 |
| `avif` | ⚠️ 仅 Safari 17+ | ✅ libavif（`@jsquash/avif`） | **Chrome / Firefox 无原生 avif 编码**——`canvas.toBlob('image/avif')` 会静默回退 PNG；`encodeSmart` 探测到回退后分发到私有 worker 走 wasm 编码 |
| `gif` | ❌ | — | Canvas 不支持 gif 编码，抛错 |

> wasm 兜底默认启用，二进制经版本化 CDN（jsdelivr，随 `@lokvis/engine-image` 发布）或自托管加载，Service Worker cache-first 缓存；消费方可用 `configureWasmEncoders({ avifUrl, enabled })` 覆盖。详见 [`docs/reports/20260724-engine-wasm-avif-encoder.md`](./reports/20260724-engine-wasm-avif-encoder.md)。

### Video（`@lokvis/plugin-video`，ffmpeg.wasm，Phase 2）

| 能力 | 说明 | 浏览器 | Node |
|------|------|--------|------|
| `video.compress` | 视频压缩 | ⛔ stub | ✅ `plugin-video/node`（ffmpeg-static） |
| `video.transcode` | 转码（MP4/WebM/GIF） | ⛔ stub | ✅ `plugin-video/node` |
| `video.trim` | 裁剪时间段 | ⛔ stub | ✅ `plugin-video/node` |
| `video.merge` | 视频拼接 | ⛔ stub | ✅ `plugin-video/node` |
| `video.extract-audio` | 提取音频 | ⛔ stub | ✅ `plugin-video/node` |
| `video.to-gif` | 转 GIF | ⛔ stub | ✅ `plugin-video/node` |
| `video.screenshot` | 截图 | ⛔ stub | ✅ `plugin-video/node` |

> **三方接入**：`@lokvis/embed-video` 提供三层组件（hooks / primitives / default UI），集成契约已完备。当前浏览器引擎为 stub，调用后 error 状态体现"能力不可用"；引擎实装后（wasm / remote backend）hooks 零改动生效。三方可通过 `plugins` 选项注入自定义处理插件（如 remote-processing plugin）。

### PDF（`@lokvis/plugin-pdf`，pdf-lib）

| 能力 | 说明 | 浏览器 | Node |
|------|------|--------|------|
| `pdf.merge` | 合并(N→1) | ✅ `plugin-pdf/web` | ✅ `plugin-pdf/node` |
| `pdf.split` | 拆分(1→N) | ✅ `plugin-pdf/web` | ✅ `plugin-pdf/node` |
| `pdf.compress` | 压缩 | ✅ `plugin-pdf/web` | ✅ `plugin-pdf/node` |
| `pdf.rotate` | 旋转 | ✅ `plugin-pdf/web` | ✅ `plugin-pdf/node` |
| `pdf.watermark` | 水印 | ✅ `plugin-pdf/web` | ✅ `plugin-pdf/node` |
| `pdf.ocr` | OCR（tesseract.js） | ⛔ stub（Phase 3） | ⛔ stub（Phase 3） |
| `pdf.sign` | 数字签名 | ⛔ stub（Phase 4） | ⛔ stub（Phase 4） |

> **浏览器端激活路径**：默认入口 `@lokvis/plugin-pdf`（`"."`）为全 stub（不加载 pdf-lib，省首屏）；浏览器端真实处理需使用 `@lokvis/plugin-pdf/web` 子路径导出（`pdfToolsPluginWeb()`），pdf-lib 经动态 import 按需加载（~90KB gzip）。
>
> **三方接入**：`@lokvis/embed-pdf` 提供三层组件（hooks / primitives / default UI），内部使用 `plugin-pdf/web`，cloud 等消费方只需 `import { usePdfCompress } from '@lokvis/embed-pdf/hooks'` 即可自建品牌 UI。

### Audio（`@lokvis/plugin-audio`，Web Audio API，Phase 3）

| 能力 | 说明 |
|------|------|
| `audio.trim` | 裁剪 |
| `audio.merge` | 拼接 |
| `audio.transcode` | 转码（MP3/WAV/AAC/FLAC/OGG） |
| `audio.normalize` | 音量标准化 |

> 注：`audio.denoise` 在前期文档中曾出现，但 manifest 与 engine-audio 均未声明该能力。如未来需要降噪，需在 `packages/capability/manifests/audio.manifest.json`、`engine-audio`、`plugin-audio` 三处同步补齐。

### Asset（跨域）

| 能力 | 说明 | 参数 |
|------|------|------|
| `asset.rename` | 模式重命名 | pattern (`{name}` `{index}` `{date}`) |
| `asset.archive` | 打包为 zip | format (zip) |

### AI（`@lokvis/engine-ai`，Phase 2+）

| 能力 | 说明 | 定位 |
|------|------|------|
| `ai.generate-workflow` | AI 辅助生成 workflow JSON | cloudProxyEngine |
| `ai.optimize-workflow` | AI 优化已有 workflow | cloudProxyEngine |
| `ai.ocr` | 本地 OCR | transformersEngine |
| `ai.caption` | 图片描述（无障碍/SEO） | transformersEngine |
| `ai.background-remove` | 背景移除 | transformersEngine |

### Developer（`@lokvis/plugin-dev`，Phase 4）

| 能力 | 说明 |
|------|------|
| `developer.inspect.capabilities` | 查看所有已注册能力 |
| `developer.inspect.asset` | 查看资产元数据 |
| `developer.validate.workflow` | 校验 workflow JSON |
| `developer.profile` | 性能分析 |

---

## 自定义能力

插件可以声明自定义能力。标准化命名有助于：

- Marketplace 搜索
- Workflow 可移植性
- AI workflow 生成

### MCP 暴露配置

每个 capability 可通过 `mcpExposure` 字段控制是否暴露给 MCP：

| 值 | 说明 |
|----|------|
| `'public'`（默认） | 暴露给 MCP |
| `'private'` | 不暴露（内部/危险能力） |
| `'batch-only'` | 仅在 batch 模式暴露 |

可选 `mcpToolName` 字段覆盖默认命名（默认为 `lokvis_${name.replace(/\./g, '_')}`）。

---

## 平台预设库（20+ 平台）

| 平台 | 尺寸 | 用途 |
|------|------|------|
| YouTube Thumbnail | 1280×720 | 视频缩略图 |
| TikTok Cover | 1080×1920 | 短视频封面 |
| Instagram Square | 1080×1080 | 方形帖子 |
| Instagram Story | 1080×1920 | 故事 |
| Twitter/X Card | 1200×675 | 卡片预览 |
| LinkedIn Banner | 1584×396 | 横幅 |
| Facebook Cover | 820×312 | 封面 |
| Pinterest Pin | 1000×1500 | Pin |
| Shopify Product | 2048×2048 | 商品主图 |
| Etsy Listing | 2000×2000 | 商品图 |
| Amazon A+ | 970×600 | 增强内容 |
| ... | ... | 更多 |

---

*本文档整合自 `apps/docs/src/content/docs/capabilities.md` 与白皮书 04 §能力层设计。*
