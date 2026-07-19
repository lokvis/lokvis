/**
 * 工具页 SEO 元数据配置(W8.7)。
 *
 * 每个工具页对应一条 ToolSeo 记录,ToolLayout.astro 据此自动生成:
 *   - <title>(覆盖 PlaygroundLayout 默认值)
 *   - <meta name="description">
 *   - <meta name="keywords">(可选)
 *   - Open Graph:title / description / image / type
 *   - Twitter Card:summary_large_image
 *
 * og-image:构建期由 `src/pages/og/[slug].png.ts` 用 sharp 把 buildOgSvg 产出的
 * SVG 栅格化成 1200×630 PNG,og:image 指向该 PNG 的绝对 HTTPS URL。
 * 不使用 SVG data URI —— Twitter / Facebook / LinkedIn 等平台均不支持 SVG
 * (无论 data URI 还是 .svg URL)作为 og:image,且 og:image 规范要求绝对 URL。
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
      '本地浏览器调整图片尺寸,内置 20+ 平台 63 尺寸预设(YouTube/IG/TikTok/Shopify 等),支持自定义预设、DPI 输入(72/150/300)。文件不上传。',
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
  'pdf-compress': {
    slug: 'pdf-compress',
    title: 'PDF 压缩 · 级别 1-9',
    description:
      '压缩 PDF 文件大小,支持 1-9 级压缩(1=最快/最低,9=最慢/最高)。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['PDF 压缩', 'pdf.compress', '减小 PDF 体积', 'Node 端处理'],
  },
  'pdf-rotate': {
    slug: 'pdf-rotate',
    title: 'PDF 旋转 · 90/180/270 + 页码范围',
    description:
      '旋转 PDF 页面,支持 90/180/270 度与页码范围选择。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['PDF 旋转', 'pdf.rotate', '旋转 PDF 页面', 'Node 端处理'],
  },
  'pdf-watermark': {
    slug: 'pdf-watermark',
    title: 'PDF 加水印 · 文字水印',
    description:
      '给 PDF 加文字水印,支持颜色、透明度、字号。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['PDF 水印', 'pdf.watermark', 'PDF 加水印', 'Node 端处理'],
  },
  'pdf-split': {
    slug: 'pdf-split',
    title: 'PDF 拆分 · 单页 / 按页数 / 自定义范围',
    description:
      '拆分 PDF 为多个文件,支持每页一个、按页数拆分、自定义范围三种模式。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['PDF 拆分', 'pdf.split', 'PDF 分割', 'Node 端处理'],
  },
  'pdf-merge': {
    slug: 'pdf-merge',
    title: 'PDF 合并 · N→1',
    description:
      '合并多个 PDF 为一个文件,支持对象流选项(输出更小)。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['PDF 合并', 'pdf.merge', 'PDF 拼接', 'Node 端处理'],
  },
  'pdf-extract-pages': {
    slug: 'pdf-extract-pages',
    title: 'PDF 提取页 · 按页码范围',
    description:
      '从 PDF 中提取指定页码范围的页面,如 1-3,5,7-9。复用 pdf.split capability 的 ranges 模式。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['PDF 提取页', '提取 PDF 页', 'pdf.split', 'Node 端处理'],
  },
  'video-compress': {
    slug: 'video-compress',
    title: '视频压缩 · CRF + Scale',
    description:
      '压缩视频,支持 MP4/WebM 输出、CRF(0-51)与分辨率缩放系数(0.25-1)。浏览器端为 stub(不加载 ffmpeg.wasm ~30MB),实际处理在 Node(mcp-server)。',
    keywords: ['视频压缩', 'video.compress', 'CRF', 'ffmpeg', 'Node 端处理'],
  },
  'video-transcode': {
    slug: 'video-transcode',
    title: '视频转码 · MP4/WebM/GIF',
    description:
      '视频格式转码,支持 MP4/WebM/GIF 互转,可选 codec(libx264 / libvpx-vp9 / gif)。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['视频转码', 'video.transcode', 'MP4', 'WebM', 'GIF', 'Node 端处理'],
  },
  'video-trim': {
    slug: 'video-trim',
    title: '视频裁剪 · 起止时间',
    description:
      '按起止时间裁剪视频片段,HTML5 video 时间轴选择器。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['视频裁剪', 'video.trim', '视频剪辑', '时间轴', 'Node 端处理'],
  },
  'video-to-gif': {
    slug: 'video-to-gif',
    title: '视频转 GIF · FPS + 宽度 + 范围',
    description:
      '视频转动画 GIF,支持 FPS、宽度与时间范围。输出为 GIF 图像。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['视频转 GIF', 'video.to-gif', '动画 GIF', 'Node 端处理'],
  },
  'video-thumbnail': {
    slug: 'video-thumbnail',
    title: '视频缩略图 · 截取一帧',
    description:
      '从视频指定时间点截取一帧作为缩略图,支持 PNG/JPEG/WebP 输出。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['视频缩略图', 'video.screenshot', '截帧', 'Node 端处理'],
  },
  'audio-trim': {
    slug: 'audio-trim',
    title: '音频裁剪 · 起止时间',
    description:
      '按起止时间裁剪音频片段,HTML5 audio 时间轴选择器。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['音频裁剪', 'audio.trim', '音频剪辑', '时间轴', 'Node 端处理'],
  },
  'audio-normalize': {
    slug: 'audio-normalize',
    title: '音频响度归一 · 目标 LUFS',
    description:
      '将音频响度归一到目标 LUFS(-30~0 dB,默认 -16)。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['音频归一', 'audio.normalize', '响度归一', 'LUFS', 'Node 端处理'],
  },
  'audio-transcode': {
    slug: 'audio-transcode',
    title: '音频转码 · MP3/WAV/OGG/AAC',
    description:
      '音频格式转码,支持 MP3/WAV/OGG/AAC 互转,可选码率(32~320 kbps)。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['音频转码', 'audio.transcode', 'MP3', 'WAV', 'OGG', 'AAC', 'Node 端处理'],
  },
  'audio-merge': {
    slug: 'audio-merge',
    title: '音频合并 · N→1',
    description:
      '合并多个音频为一个文件,支持目标格式选择。浏览器端为 stub,实际处理在 Node(mcp-server)。',
    keywords: ['音频合并', 'audio.merge', '音频拼接', 'Node 端处理'],
  },
  'ai-generator': {
    slug: 'ai-generator',
    title: 'AI 工作流生成器 · 自然语言→Workflow',
    description:
      '用自然语言描述你想要的操作,AI 自动生成 lokvis workflow。Playground 为开源 demo,不内置 cloud AI,实际生成在 lokvis cloud 运行。',
    keywords: ['AI 工作流生成器', 'ai.generate-workflow', '自然语言转 workflow', 'cloud AI'],
  },
  'dev-regex': {
    slug: 'dev-regex',
    title: '正则表达式测试器 · matches / groups / indices',
    description:
      '在线正则表达式测试器,支持全局匹配、具名捕获组、零宽匹配防护。浏览器本地执行,不上传。',
    keywords: ['正则表达式测试', 'regex tester', 'developer.regex.test', '捕获组', '本地处理'],
  },
  'dev-diff': {
    slug: 'dev-diff',
    title: '文本 Diff 对比 · LCS 行级差异',
    description:
      '在线文本对比工具,基于 LCS 算法生成 unified-diff 风格的 hunks。浏览器本地执行,不上传。',
    keywords: ['文本对比', 'diff', 'developer.diff', 'LCS', 'unified diff', '本地处理'],
  },
  'dev-base64': {
    slug: 'dev-base64',
    title: 'Base64 编解码 · UTF-8 / 二进制',
    description:
      '在线 Base64 编码/解码工具,支持 UTF-8 文本与二进制数据(hex 视图)。浏览器本地执行,不上传。',
    keywords: ['Base64 编码', 'Base64 解码', 'developer.base64', 'UTF-8', '本地处理'],
  },
  'dev-hash': {
    slug: 'dev-hash',
    title: '哈希计算器 · SHA-1/256/384/512/MD5',
    description:
      '在线哈希计算器,支持 SHA-1/SHA-256/SHA-384/SHA-512/MD5。SHA 用 Web Crypto API,MD5 纯 TS 实现。浏览器本地执行。',
    keywords: ['哈希计算', 'SHA-256', 'MD5', 'developer.hash', 'Web Crypto', '本地处理'],
  },
  'dev-jwt': {
    slug: 'dev-jwt',
    title: 'JWT 解码器 · header / payload(不验签)',
    description:
      '在线 JWT 解码器,解析三段结构(header.payload.signature),提取常见字段(alg/typ/sub/iat/exp)。不验证签名。浏览器本地执行。',
    keywords: ['JWT 解码', 'JWT decode', 'developer.jwt.decode', 'base64url', '本地处理'],
  },
};

/**
 * 构建 OG 图像的 SVG 源码(1200×630,品牌渐变 + 工具名 + 副标)。
 *
 * 返回 SVG 字符串,供 `src/pages/og/[slug].png.ts` 在构建期用 sharp 栅格化成 PNG。
 * 不在此处生成 data URI —— 见文件头注释,SVG data URI 不能作为 og:image。
 */
export function buildOgSvg(title: string, subtitle = '本地处理 · 不上传'): string {
  // 转义 SVG 中的特殊字符(< > & " ')
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
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
}
