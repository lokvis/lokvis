/**
 * 工具页 SEO 元数据配置(W8.7)。
 *
 * 每个工具页对应一条 ToolSeo 记录,ToolLayout.astro 据此自动生成:
 *   - <title>(覆盖 BaseLayout 默认值)
 *   - <meta name="description">
 *   - <meta name="keywords">(可选)
 *   - Open Graph:title / description / image / type
 *   - Twitter Card:summary_large_image
 *
 * og-image 采用 SVG data URI(无外部依赖):
 *   - 1200×630,品牌渐变背景
 *   - 工具名 + 副标 + "Lokvis · 本地处理不上传"
 *
 * 注意:playground 整体 `noindex,nofollow`(开发者 demo,非公开 SEO 站点),
 *      OG/Twitter 卡片仅供分享时预览,不影响搜索引擎收录。
 */
export interface ToolSeo {
  /** URL slug,如 'compress' */
  slug: string;
  /** 工具页中文标题(用于 <title> 与 OG title) */
  title: string;
  /** 工具页描述(用于 meta description 与 OG description) */
  description: string;
  /** 关键词(可选,逗号分隔的数组) */
  keywords?: string[];
}

export const TOOL_SEO: Record<string, ToolSeo> = {
  compress: {
    slug: 'compress',
    title: '在线图片压缩 · WebP/AVIF · 目标体积',
    description:
      '本地浏览器压缩图片为 WebP/AVIF/JPEG/PNG,支持目标体积压缩(如 ≤100KB)、智能格式(透明→PNG,否则→WebP)。文件不上传,隐私安全。',
    keywords: ['图片压缩', 'WebP', 'AVIF', '目标体积压缩', '在线压缩', '本地处理'],
  },
  resize: {
    slug: 'resize',
    title: '在线图片缩放 · 平台预设 · DPI',
    description:
      '本地浏览器调整图片尺寸,内置 20+ 平台 80+ 尺寸预设(YouTube/IG/TikTok/Shopify 等),支持自定义预设、DPI 输入(72/150/300)。文件不上传。',
    keywords: ['图片缩放', '图片 resize', '平台预设', 'YouTube 封面', 'DPI', '本地处理'],
  },
  convert: {
    slug: 'convert',
    title: '在线图片格式转换 · PNG/JPEG/WebP/AVIF',
    description:
      '本地浏览器互转图片格式(PNG/JPEG/WebP/AVIF/GIF),支持质量调节。文件不上传,隐私安全。',
    keywords: ['图片格式转换', 'PNG 转 WebP', 'WebP 转 JPEG', 'AVIF', '本地处理'],
  },
  crop: {
    slug: 'crop',
    title: '在线图片裁剪 · 自由比例 · 预设',
    description:
      '本地浏览器裁剪图片,支持自由比例与常用预设(1:1/4:3/16:9 等)。文件不上传,隐私安全。',
    keywords: ['图片裁剪', 'crop', '比例裁剪', '1:1', '16:9', '本地处理'],
  },
  watermark: {
    slug: 'watermark',
    title: '在线图片加水印 · 文字水印 · 9 宫格位置',
    description:
      '本地浏览器给图片加文字水印,支持 9 宫格位置、字体大小、颜色、透明度。文件不上传,隐私安全。',
    keywords: ['图片水印', '文字水印', '加水印', '9 宫格', '本地处理'],
  },
  'watermark-batch': {
    slug: 'watermark-batch',
    title: '批量图片加水印 · 并发 4 · 多文件',
    description:
      '本地浏览器批量给多张图片加水印,并发 4 池,逐个进度追踪。文件不上传,隐私安全。',
    keywords: ['批量水印', '批量加水印', '并发处理', '本地处理'],
  },
  batch: {
    slug: 'batch',
    title: '批量图片处理 · 并发 4 · 多 capability',
    description:
      '本地浏览器批量处理多张图片(compress/resize/convert/watermark 等),并发 4 池,进度追踪。文件不上传。',
    keywords: ['批量图片处理', 'batch queue', '并发处理', '本地处理'],
  },
  download: {
    slug: 'download',
    title: '下载管理器 · 单/批量下载',
    description:
      '管理本地浏览器中处理后的图片下载,支持单文件与批量下载。文件始终在浏览器本地,不上传。',
    keywords: ['下载管理', '批量下载', '本地处理'],
  },
};

/**
 * 生成 OG 图像(SVG data URI)。1200×630,品牌渐变 + 工具名 + 副标。
 *
 * 用 SVG 而非 PNG/JPG:无需 canvas 渲染,纯字符串拼接,体积小(< 2KB)。
 * Twitter/Facebook 在 2024+ 已支持 SVG data URI 作为 og:image。
 */
export function generateOgImage(title: string, subtitle = '本地处理 · 不上传'): string {
  // 转义 SVG 中的特殊字符(< > & " ')
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f0f23"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="80" y="80" width="80" height="6" rx="3" fill="url(#accent)"/>
  <text x="80" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="700" fill="#f4f4f5">${esc(title)}</text>
  <text x="80" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="500" fill="#a1a1aa">${esc(subtitle)}</text>
  <text x="80" y="540" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="600" fill="url(#accent)">◆ Lokvis Playground</text>
  <text x="80" y="580" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="#71717a">open source · runs in your browser</text>
</svg>`;
  // encodeURIComponent + data URI(SVG 需要 utf-8 charset)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
