/**
 * PWA 图标生成脚本（W15 review fix）
 *
 * 从 public/icon.svg 生成 PWA 必需的 PNG 图标：
 *   - icon-192.png         (192×192, any purpose)
 *   - icon-512.png         (512×512, any purpose)
 *   - icon-maskable-512.png (512×512, maskable purpose, 含 safe zone)
 *
 * Maskable 图标需要满足 Android Adaptive Icon 规范：
 *   - 背景全铺（无圆角，OS 负责裁剪为圆形/圆角矩形）
 *   - 关键内容位于中心 80% 安全区内（半径 ≤ 40%）
 *   - 故 maskable 变体把 ◆ 字号从 320 缩到 200，确保不超出安全区
 *
 * 运行：node apps/playground/scripts/generate-pwa-icons.mjs
 * 依赖：sharp（playground devDependency）
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');
const svgPath = resolve(publicDir, 'icon.svg');

/** Maskable 变体 SVG：全铺背景 + 缩小内容到安全区内 */
function buildMaskableSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#09090b"/>
  <text x="256" y="256" font-family="system-ui,sans-serif" font-size="200" font-weight="bold" text-anchor="middle" dominant-baseline="central" fill="url(#g)">◆</text>
</svg>`;
}

async function main() {
  const svgBuffer = await readFile(svgPath);
  const maskableSvgBuffer = Buffer.from(buildMaskableSvg());

  const targets = [
    { name: 'icon-192.png', size: 192, source: svgBuffer },
    { name: 'icon-512.png', size: 512, source: svgBuffer },
    { name: 'icon-maskable-512.png', size: 512, source: maskableSvgBuffer },
  ];

  for (const { name, size, source } of targets) {
    const outPath = resolve(publicDir, name);
    await sharp(source, { density: 384 })
      .resize(size, size, { fit: 'contain' })
      .png({ compressionLevel: 9, quality: 90 })
      .toFile(outPath);
    console.log(`✓ generated ${name} (${size}×${size})`);
  }
  console.log('All PWA icons generated.');
}

main().catch((err) => {
  console.error('Failed to generate PWA icons:', err);
  process.exit(1);
});
