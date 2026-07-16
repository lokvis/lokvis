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

### Video（`@lokvis/plugin-video`，ffmpeg.wasm，Phase 2）

| 能力 | 说明 |
|------|------|
| `video.compress` | 视频压缩 |
| `video.transcode` | 转码（MP4/WebM/GIF） |
| `video.trim` | 裁剪时间段 |
| `video.merge` | 视频拼接 |
| `video.extract-audio` | 提取音频 |
| `video.to-gif` | 转 GIF |
| `video.screenshot` | 截图 |

### PDF（`@lokvis/plugin-pdf`，pdf-lib，Phase 2）

| 能力 | 说明 |
|------|------|
| `pdf.merge` | 合并 |
| `pdf.split` | 拆分 |
| `pdf.compress` | 压缩 |
| `pdf.rotate` | 旋转 |
| `pdf.watermark` | 水印 |
| `pdf.ocr` | OCR（tesseract.js） |
| `pdf.sign` | 数字签名 |

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
