/**
 * OG 图像构建期 PNG 端点(W8.7 长期方案)。
 *
 * 为每个工具页生成 1200×630 PNG:用 sharp 把 `buildOgSvg` 产出的 SVG 栅格化。
 * Astro 静态构建 + getStaticPaths → 构建期生成 `og/<slug>.png` 静态文件,
 * 部署后通过绝对 URL `https://lokvis.com/playground/og/<slug>.png` 引用。
 *
 * 为什么不用 SVG data URI:Twitter / Facebook / LinkedIn 等平台均不支持 SVG
 * (data URI 或 .svg URL)作为 og:image,且 og:image 规范要求绝对 HTTPS URL。
 * PNG 是所有平台通用的 OG 图像格式。sharp 是工作区已有依赖(docs 同样使用)。
 *
 * 字体:SVG 指定 `system-ui, -apple-system, sans-serif`,构建环境(Linux)回落到
 * DejaVu Sans(fontconfig 默认)。本地 macOS/Windows 构建会用系统字体,视觉更佳。
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { TOOL_SEO, buildOgSvg } from '../../components/tools/seo';

export const getStaticPaths = (async () => {
  return Object.keys(TOOL_SEO).map((slug) => ({ params: { slug } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const seo = TOOL_SEO[params.slug!];
  if (!seo) return new Response('Not found', { status: 404 });

  const svg = buildOgSvg(seo.title);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  // 拷贝到独立 ArrayBuffer 后用 Uint8Array 视图传入 Response:
  // sharp 返回的 Node Buffer 类型在 TS 5.7+ 严格 BodyInit 校验下不兼容
  // (Buffer<ArrayBufferLike> 缺少 BodyInit 期望的属性),故显式转 Uint8Array。
  const bytes = new Uint8Array(png.length);
  bytes.set(png);
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/png',
      // 内容按 slug 固定,可长久缓存
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
