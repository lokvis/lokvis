/**
 * 平台尺寸预设库(W8.1)
 *
 * 提供 20+ 主流平台的图像尺寸预设(YouTube/TikTok/IG/Shopify/Etsy/Twitter/
 * LinkedIn 等)。供 resize/crop 工具页的"平台预设选择器"使用,让用户一键
 * 选择目标平台的推荐尺寸,而非手动查文档输入 width/height。
 *
 * 数据来源:各平台官方创作者文档(2026 年公开数据)。
 * 平台官方推荐尺寸会不定期调整,设计上把数据集中在此文件,
 * 后续更新只改这一个文件即可。
 *
 * 设计要点:
 * - 每个预设包含 id / platform / name / width / height / category / 可选描述
 * - id 全局唯一(`${platform}.${useCase}`),供选择器 value 与自定义预设区分
 * - category 用于按用途分组(社媒 / 电商 / 视频 / 打印 / 通用)
 * - 不绑定具体 Capability:同一预设可用于 resize(fit)或 crop(居中裁剪)
 *
 * 注:不依赖 @lokvis/engine-image 的 FitStrategy 类型(五层架构单向依赖,
 * capability 包只依赖 schema)。FitStrategy 取值与 engine-image 的同名类型
 * 一致(由 IMAGE_RESIZE.params.fit enum values 定义),保持字符串字面量对齐即可。
 */

/** 平台预设用途分类(供选择器分组展示) */
export type PlatformPresetCategory =
  | 'social'
  | 'ecommerce'
  | 'video'
  | 'print'
  | 'other';

/** 推荐输出格式 */
export type PlatformRecommendedFormat = 'png' | 'jpeg' | 'webp';

/**
 * resize fit 策略(与 engine-image FitStrategy 取值对齐)。
 *
 * - `cover`:缩放并裁剪溢出部分(填满目标尺寸)
 * - `contain`:缩放并在不足处留白(完整可见)
 * - `fill`:拉伸到目标尺寸(可能变形)
 * - `inside`:等比缩放到目标尺寸内(可能小于目标)
 * - `outside`:等比缩放到目标尺寸外(可能大于目标)
 */
export type PlatformFitStrategy = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/**
 * 平台尺寸预设。
 *
 * 字段语义:
 * - `width`/`height`:目标像素尺寸。resize 按此尺寸缩放,crop 按此尺寸居中裁剪
 * - `recommendedFormat`:多数平台 JPEG/WebP 兼容性最好;含透明背景用 PNG
 * - `recommendedFit`:resize 时建议的 fit 策略(`cover` 裁掉溢出 / `contain` 留黑边)
 */
export interface PlatformSizePreset {
  /** 全局唯一 ID,如 `youtube.thumbnail` */
  id: string;
  /** 平台名,如 `YouTube` */
  platform: string;
  /** 该尺寸的具体用途名,如 `Thumbnail (1280×720)` */
  name: string;
  /** 目标宽度(像素) */
  width: number;
  /** 目标高度(像素) */
  height: number;
  /** 用途分类 */
  category: PlatformPresetCategory;
  /** 用途描述(可选) */
  description?: string;
  /** 推荐输出格式(可选) */
  recommendedFormat?: PlatformRecommendedFormat;
  /** 推荐 fit 策略(可选,默认 cover) */
  recommendedFit?: PlatformFitStrategy;
}

/**
 * 内置平台尺寸预设(20+ 平台,80+ 尺寸)。
 *
 * 排序约定:同 category 内按 platform 分组,同 platform 内按常用度从高到低。
 */
export const PLATFORM_PRESETS: PlatformSizePreset[] = [
  // ─── social(社媒)───────────────────────────────────────
  {
    id: 'youtube.thumbnail',
    platform: 'YouTube',
    name: '视频缩略图',
    width: 1280,
    height: 720,
    category: 'social',
    description: '视频封面,16:9 比例',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'youtube.channel-art',
    platform: 'YouTube',
    name: '频道封面',
    width: 2560,
    height: 1440,
    category: 'social',
    description: '频道顶部横幅(电视端完整尺寸)',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'youtube.profile',
    platform: 'YouTube',
    name: '频道头像',
    width: 800,
    height: 800,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'youtube.short',
    platform: 'YouTube',
    name: 'Shorts 竖版',
    width: 1080,
    height: 1920,
    category: 'social',
    description: '9:16 竖版短视频',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'instagram.square',
    platform: 'Instagram',
    name: '方形帖子',
    width: 1080,
    height: 1080,
    category: 'social',
    description: '1:1 方形动态',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'instagram.portrait',
    platform: 'Instagram',
    name: '竖版帖子',
    width: 1080,
    height: 1350,
    category: 'social',
    description: '4:5 竖版(最大可见)',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'instagram.landscape',
    platform: 'Instagram',
    name: '横版帖子',
    width: 1080,
    height: 566,
    category: 'social',
    description: '1.91:1 横版',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'instagram.story',
    platform: 'Instagram',
    name: 'Story / Reel',
    width: 1080,
    height: 1920,
    category: 'social',
    description: '9:16 全屏竖版',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'instagram.profile',
    platform: 'Instagram',
    name: '头像',
    width: 320,
    height: 320,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'tiktok.video',
    platform: 'TikTok',
    name: '视频',
    width: 1080,
    height: 1920,
    category: 'social',
    description: '9:16 竖版视频',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'tiktok.profile',
    platform: 'TikTok',
    name: '头像',
    width: 200,
    height: 200,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'twitter.post',
    platform: 'Twitter / X',
    name: '帖子配图',
    width: 1200,
    height: 675,
    category: 'social',
    description: '16:9 单图/多图',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'twitter.header',
    platform: 'Twitter / X',
    name: '横幅',
    width: 1500,
    height: 500,
    category: 'social',
    description: '3:1 个人页横幅',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'twitter.profile',
    platform: 'Twitter / X',
    name: '头像',
    width: 400,
    height: 400,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'facebook.cover',
    platform: 'Facebook',
    name: '封面',
    width: 1640,
    height: 856,
    category: 'social',
    description: '个人/公共主页封面',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'facebook.post',
    platform: 'Facebook',
    name: '帖子配图',
    width: 1200,
    height: 630,
    category: 'social',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'facebook.profile',
    platform: 'Facebook',
    name: '头像',
    width: 320,
    height: 320,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'linkedin.post',
    platform: 'LinkedIn',
    name: '帖子配图',
    width: 1200,
    height: 627,
    category: 'social',
    description: '1.91:1 链接预览',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'linkedin.cover',
    platform: 'LinkedIn',
    name: '个人封面',
    width: 1584,
    height: 396,
    category: 'social',
    description: '4:1 横幅',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'linkedin.profile',
    platform: 'LinkedIn',
    name: '头像',
    width: 400,
    height: 400,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'linkedin.company-logo',
    platform: 'LinkedIn',
    name: '公司 Logo',
    width: 300,
    height: 300,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'pinterest.pin',
    platform: 'Pinterest',
    name: '标准 Pin',
    width: 1000,
    height: 1500,
    category: 'social',
    description: '2:3 竖版 Pin',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'pinterest.square',
    platform: 'Pinterest',
    name: '方形 Pin',
    width: 1000,
    height: 1000,
    category: 'social',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'snapchat.story',
    platform: 'Snapchat',
    name: 'Story / Ad',
    width: 1080,
    height: 1920,
    category: 'social',
    description: '9:16 全屏',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'reddit.post',
    platform: 'Reddit',
    name: '帖子图片',
    width: 1024,
    height: 1024,
    category: 'social',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'reddit.banner',
    platform: 'Reddit',
    name: '版块横幅',
    width: 1920,
    height: 256,
    category: 'social',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'whatsapp.status',
    platform: 'WhatsApp',
    name: 'Status',
    width: 1080,
    height: 1920,
    category: 'social',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'whatsapp.profile',
    platform: 'WhatsApp',
    name: '头像',
    width: 640,
    height: 640,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'wechat.article',
    platform: 'WeChat',
    name: '公众号封面',
    width: 900,
    height: 500,
    category: 'social',
    description: '1.8:1 头图',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'wechat.moment',
    platform: 'WeChat',
    name: '朋友圈',
    width: 1080,
    height: 1080,
    category: 'social',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'xiaohongshu.post',
    platform: '小红书',
    name: '笔记配图',
    width: 1080,
    height: 1440,
    category: 'social',
    description: '3:4 竖版',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'discord.avatar',
    platform: 'Discord',
    name: '头像',
    width: 128,
    height: 128,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'discord.banner',
    platform: 'Discord',
    name: '服务器横幅',
    width: 600,
    height: 240,
    category: 'social',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'telegram.profile',
    platform: 'Telegram',
    name: '头像',
    width: 512,
    height: 512,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'twitch.profile',
    platform: 'Twitch',
    name: '头像',
    width: 256,
    height: 256,
    category: 'social',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'twitch.banner',
    platform: 'Twitch',
    name: '横幅',
    width: 1200,
    height: 480,
    category: 'social',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'spotify.cover',
    platform: 'Spotify',
    name: '歌单封面',
    width: 300,
    height: 300,
    category: 'social',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },

  // ─── ecommerce(电商)──────────────────────────────────
  {
    id: 'shopify.product',
    platform: 'Shopify',
    name: '商品主图',
    width: 2048,
    height: 2048,
    category: 'ecommerce',
    description: '方形商品图',
    recommendedFormat: 'jpeg',
    recommendedFit: 'contain',
  },
  {
    id: 'shopify.banner',
    platform: 'Shopify',
    name: '首页横幅',
    width: 1200,
    height: 400,
    category: 'ecommerce',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'shopify.thumbnail',
    platform: 'Shopify',
    name: '缩略图',
    width: 800,
    height: 800,
    category: 'ecommerce',
    recommendedFormat: 'jpeg',
    recommendedFit: 'contain',
  },
  {
    id: 'etsy.listing',
    platform: 'Etsy',
    name: '商品图',
    width: 2000,
    height: 2000,
    category: 'ecommerce',
    recommendedFormat: 'jpeg',
    recommendedFit: 'contain',
  },
  {
    id: 'etsy.thumbnail',
    platform: 'Etsy',
    name: '缩略图',
    width: 570,
    height: 456,
    category: 'ecommerce',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'etsy.header',
    platform: 'Etsy',
    name: '店铺横幅',
    width: 1200,
    height: 300,
    category: 'ecommerce',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'amazon.product',
    platform: 'Amazon',
    name: '商品主图',
    width: 2000,
    height: 2000,
    category: 'ecommerce',
    description: '主图必须为纯白背景',
    recommendedFormat: 'jpeg',
    recommendedFit: 'contain',
  },
  {
    id: 'amazon.header',
    platform: 'Amazon',
    name: '品牌横幅',
    width: 1500,
    height: 315,
    category: 'ecommerce',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'ebay.listing',
    platform: 'eBay',
    name: '商品图',
    width: 1600,
    height: 1600,
    category: 'ecommerce',
    recommendedFormat: 'jpeg',
    recommendedFit: 'contain',
  },
  {
    id: 'taobao.product',
    platform: '淘宝 / 天猫',
    name: '商品主图',
    width: 800,
    height: 800,
    category: 'ecommerce',
    recommendedFormat: 'jpeg',
    recommendedFit: 'contain',
  },
  {
    id: 'taobao.detail',
    platform: '淘宝 / 天猫',
    name: '详情图',
    width: 750,
    height: 1000,
    category: 'ecommerce',
    recommendedFormat: 'jpeg',
    recommendedFit: 'contain',
  },

  // ─── video(视频封面/缩略图)────────────────────────────
  {
    id: 'video.thumbnail-hd',
    platform: '通用视频',
    name: 'HD 缩略图',
    width: 1280,
    height: 720,
    category: 'video',
    description: '16:9 720p',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'video.thumbnail-4k',
    platform: '通用视频',
    name: '4K 缩略图',
    width: 3840,
    height: 2160,
    category: 'video',
    description: '16:9 4K',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'video.vertical',
    platform: '通用视频',
    name: '竖版视频',
    width: 1080,
    height: 1920,
    category: 'video',
    description: '9:16 竖版',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'video.square',
    platform: '通用视频',
    name: '方形视频',
    width: 1080,
    height: 1080,
    category: 'video',
    description: '1:1 方形',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },

  // ─── print(打印)──────────────────────────────────────
  {
    id: 'print.a4-300dpi',
    platform: '打印',
    name: 'A4 (300 DPI)',
    width: 2480,
    height: 3508,
    category: 'print',
    description: 'A4 纸 300 DPI 像素尺寸',
    recommendedFormat: 'png',
    recommendedFit: 'contain',
  },
  {
    id: 'print.a4-150dpi',
    platform: '打印',
    name: 'A4 (150 DPI)',
    width: 1240,
    height: 1754,
    category: 'print',
    description: 'A4 纸 150 DPI(草稿)',
    recommendedFormat: 'png',
    recommendedFit: 'contain',
  },
  {
    id: 'print.a3-300dpi',
    platform: '打印',
    name: 'A3 (300 DPI)',
    width: 3508,
    height: 4961,
    category: 'print',
    description: 'A3 纸 300 DPI',
    recommendedFormat: 'png',
    recommendedFit: 'contain',
  },
  {
    id: 'print.business-card',
    platform: '打印',
    name: '名片(90×54mm)',
    width: 1063,
    height: 638,
    category: 'print',
    description: '90×54mm 名片 300 DPI',
    recommendedFormat: 'png',
    recommendedFit: 'contain',
  },
  {
    id: 'print.photo-4x6',
    platform: '打印',
    name: '4×6 英寸相片',
    width: 1200,
    height: 1800,
    category: 'print',
    description: '4×6 英寸 300 DPI',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },

  // ─── other(通用)──────────────────────────────────────
  {
    id: 'web.banner',
    platform: '通用 Web',
    name: '网站横幅',
    width: 1920,
    height: 600,
    category: 'other',
    recommendedFormat: 'webp',
    recommendedFit: 'cover',
  },
  {
    id: 'web.email-header',
    platform: '通用 Web',
    name: '邮件头图',
    width: 1200,
    height: 400,
    category: 'other',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'web.favicon',
    platform: '通用 Web',
    name: 'Favicon',
    width: 64,
    height: 64,
    category: 'other',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'web.og-image',
    platform: '通用 Web',
    name: 'Open Graph 图',
    width: 1200,
    height: 630,
    category: 'other',
    description: '社交分享预览图',
    recommendedFormat: 'jpeg',
    recommendedFit: 'cover',
  },
  {
    id: 'app.icon-ios',
    platform: 'App',
    name: 'iOS App Icon',
    width: 1024,
    height: 1024,
    category: 'other',
    description: 'iOS 单尺寸图标(自动派生)',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
  {
    id: 'app.icon-android',
    platform: 'App',
    name: 'Android xxxhdpi',
    width: 192,
    height: 192,
    category: 'other',
    recommendedFormat: 'png',
    recommendedFit: 'cover',
  },
];

/** 平台预设分类标签(供选择器分组标题展示) */
export const PLATFORM_PRESET_CATEGORY_LABELS: Record<PlatformPresetCategory, string> = {
  social: '社媒',
  ecommerce: '电商',
  video: '视频',
  print: '打印',
  other: '通用',
};

/**
 * 按 category 分组返回预设(供选择器 optgroup 使用)。
 *
 * 同 category 内保持原始顺序(同平台相邻),便于用户按平台查找。
 */
export function groupPlatformPresetsByCategory(
  presets: PlatformSizePreset[] = PLATFORM_PRESETS
): Map<PlatformPresetCategory, PlatformSizePreset[]> {
  const groups = new Map<PlatformPresetCategory, PlatformSizePreset[]>();
  for (const preset of presets) {
    const arr = groups.get(preset.category);
    if (arr) arr.push(preset);
    else groups.set(preset.category, [preset]);
  }
  return groups;
}

/**
 * 按平台名分组返回预设(供"先选平台,再选尺寸"的两级选择器使用)。
 */
export function groupPlatformPresetsByPlatform(
  presets: PlatformSizePreset[] = PLATFORM_PRESETS
): Map<string, PlatformSizePreset[]> {
  const groups = new Map<string, PlatformSizePreset[]>();
  for (const preset of presets) {
    const arr = groups.get(preset.platform);
    if (arr) arr.push(preset);
    else groups.set(preset.platform, [preset]);
  }
  return groups;
}

/** 按 id 查找预设 */
export function findPlatformPreset(
  id: string,
  presets: PlatformSizePreset[] = PLATFORM_PRESETS
): PlatformSizePreset | undefined {
  return presets.find((p) => p.id === id);
}

/**
 * 列出所有平台名(去重,保持首次出现顺序)。
 *
 * 供"先选平台,再选尺寸"的两级选择器使用。
 */
export function listPlatforms(
  presets: PlatformSizePreset[] = PLATFORM_PRESETS
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const preset of presets) {
    if (!seen.has(preset.platform)) {
      seen.add(preset.platform);
      out.push(preset.platform);
    }
  }
  return out;
}
