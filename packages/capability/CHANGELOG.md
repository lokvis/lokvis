# @lokvis/capability

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
