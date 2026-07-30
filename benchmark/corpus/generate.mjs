/**
 * Lokvis benchmark corpus v1 —— 确定性程序化生成器
 *
 * 设计裁决(W3.1/D1):corpus 不存二进制、不依赖外部图源——全部图像由本脚本
 * 用种子 PRNG + 纯 Node PNG 编码器(node:zlib)确定性生成,因此:
 * - 许可零风险:无任何第三方内容,Lokvis 自持有,以 CC0-1.0 发布
 * - 可复现拉取:`pnpm bench:fetch-corpus` = 重新生成 + 对 manifest sha256 校验
 * - 仓库零膨胀:images/ 进 .gitignore,只提交 manifest.json
 *
 * 五类覆盖(照片/插画/截图/透明/大尺寸),32 张,尺寸与类别见 SPECS。
 * 源格式统一为 PNG(无损规范源);jpeg/webp 源变体由 harness 在浏览器内
 * 从 PNG 派生(标准做法:同一规范源,避免双重有损基线不一致)。
 */
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(here, 'images');
const manifestPath = join(here, 'manifest.json');

export const CORPUS_VERSION = '1.0.0';

// ── 种子 PRNG(mulberry32,确定性) ────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 最小 PNG 编码器(RGBA8,filter 0,deflate level 9) ─────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0; // filter: None
    rgba.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(filtered, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 图像合成(全部确定性) ────────────────────────────────────────

/** 多八度值噪声(photo 类:高熵、JPEG 友好的连续色调) */
function paintPhoto(w, h, rand) {
  const px = Buffer.alloc(w * h * 4);
  const octaves = [
    { cell: 128, amp: 0.5 },
    { cell: 32, amp: 0.3 },
    { cell: 8, amp: 0.2 },
  ].map(({ cell, amp }) => {
    const gw = Math.ceil(w / cell) + 1;
    const gh = Math.ceil(h / cell) + 1;
    const grid = new Float64Array(gw * gh);
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    return { cell, amp, gw, grid };
  });
  const hueBase = rand() * 255;
  const sample = (o, x, y) => {
    const gx = x / o.cell;
    const gy = y / o.cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const v00 = o.grid[y0 * o.gw + x0];
    const v10 = o.grid[y0 * o.gw + x0 + 1];
    const v01 = o.grid[(y0 + 1) * o.gw + x0];
    const v11 = o.grid[(y0 + 1) * o.gw + x0 + 1];
    return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (const o of octaves) v += o.amp * sample(o, x, y);
      const i = (y * w + x) * 4;
      px[i] = Math.min(255, hueBase * 0.5 + v * 200 + (x / w) * 55);
      px[i + 1] = Math.min(255, 60 + v * 160 + (y / h) * 40);
      px[i + 2] = Math.min(255, 255 - hueBase * 0.4 - v * 120);
      px[i + 3] = 255;
    }
  }
  return px;
}

/** 平面几何图形(illustration 类:硬边缘、大色块) */
function paintIllustration(w, h, rand) {
  const px = Buffer.alloc(w * h * 4);
  const bg = [230 + rand() * 25, 230 + rand() * 25, 235 + rand() * 20];
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = bg[0];
    px[i * 4 + 1] = bg[1];
    px[i * 4 + 2] = bg[2];
    px[i * 4 + 3] = 255;
  }
  const shapes = 24;
  for (let s = 0; s < shapes; s++) {
    const kind = rand() < 0.5 ? 'circle' : 'rect';
    const cx = rand() * w;
    const cy = rand() * h;
    const r = 30 + rand() * (w / 6);
    const col = [rand() * 255, rand() * 255, rand() * 255];
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h, Math.ceil(cy + r));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (kind === 'circle' && (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const i = (y * w + x) * 4;
        px[i] = col[0];
        px[i + 1] = col[1];
        px[i + 2] = col[2];
      }
    }
  }
  return px;
}

/** 文本/UI 形态(screenshot 类:白底、行状灰条、彩色 UI 块) */
function paintScreenshot(w, h, rand) {
  const px = Buffer.alloc(w * h * 4).fill(255);
  const fill = (x0, y0, x1, y1, col) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
        const i = (y * w + x) * 4;
        px[i] = col[0];
        px[i + 1] = col[1];
        px[i + 2] = col[2];
      }
    }
  };
  // 顶部导航条 + 侧栏
  fill(0, 0, w, 56, [40 + rand() * 30, 44 + rand() * 30, 60 + rand() * 40]);
  fill(0, 56, 220, h, [244, 245, 247]);
  // 正文:模拟文本行(变长灰条)与段落间距
  let y = 90;
  while (y < h - 30) {
    const lineW = (0.35 + rand() * 0.55) * (w - 300);
    fill(260, y, 260 + Math.floor(lineW), y + 12, [90, 95, 105]);
    y += rand() < 0.15 ? 34 : 20;
  }
  // 彩色 UI 块(按钮/卡片)
  for (let b = 0; b < 6; b++) {
    const bx = 260 + Math.floor(rand() * (w - 500));
    const by = 90 + Math.floor(rand() * (h - 200));
    fill(bx, by, bx + 120, by + 36, [rand() * 200, 100 + rand() * 120, 200 + rand() * 55]);
  }
  return px;
}

/** 带 alpha 渐变的图形(transparent 类) */
function paintTransparent(w, h, rand) {
  const px = Buffer.alloc(w * h * 4); // 默认全透明
  const blobs = 8;
  const centers = Array.from({ length: blobs }, () => ({
    x: rand() * w,
    y: rand() * h,
    r: 60 + rand() * (w / 4),
    col: [rand() * 255, rand() * 255, rand() * 255],
  }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (const c of centers) {
        const d2 = (x - c.x) ** 2 + (y - c.y) ** 2;
        if (d2 > c.r * c.r) continue;
        const a = Math.round(255 * (1 - Math.sqrt(d2) / c.r));
        const i = (y * w + x) * 4;
        if (a > px[i + 3]) {
          px[i] = c.col[0];
          px[i + 1] = c.col[1];
          px[i + 2] = c.col[2];
          px[i + 3] = a;
        }
      }
    }
  }
  return px;
}

// ── corpus 规格(id/类别/尺寸/种子固定,不可回溯性修改) ────────────
const PAINTERS = {
  photo: paintPhoto,
  illustration: paintIllustration,
  screenshot: paintScreenshot,
  transparent: paintTransparent,
};

export const SPECS = [];
{
  const add = (category, count, w, h, painter = category) => {
    for (let n = 1; n <= count; n++) {
      const id = `${category}-${String(n).padStart(2, '0')}`;
      // 种子由 id 派生(FNV-1a),与生成顺序解耦
      let seed = 0x811c9dc5;
      for (const ch of id) seed = Math.imul(seed ^ ch.charCodeAt(0), 0x01000193);
      SPECS.push({ id, category, width: w, height: h, seed: seed >>> 0, painter });
    }
  };
  add('photo', 10, 1600, 1200);
  add('illustration', 8, 1200, 900);
  add('screenshot', 8, 1440, 900);
  add('transparent', 4, 800, 800);
  add('large', 2, 4000, 2400, 'photo'); // 大尺寸用 photo 纹理(最接近真实大图负载)
}

export function generateImage(spec) {
  const rand = mulberry32(spec.seed);
  const rgba = PAINTERS[spec.painter](spec.width, spec.height, rand);
  return encodePng(spec.width, spec.height, rgba);
}

// ── CLI:generate | verify ───────────────────────────────────────
function run(mode) {
  mkdirSync(imagesDir, { recursive: true });
  const prev = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const images = [];
  for (const spec of SPECS) {
    const png = generateImage(spec);
    const sha256 = createHash('sha256').update(png).digest('hex');
    const file = `${spec.id}.png`;
    writeFileSync(join(imagesDir, file), png);
    images.push({
      id: spec.id,
      file: `images/${file}`,
      category: spec.category,
      width: spec.width,
      height: spec.height,
      bytes: png.length,
      sha256,
      seed: spec.seed,
    });
    if (mode === 'verify' && prev) {
      const p = prev.images.find((i) => i.id === spec.id);
      if (!p || p.sha256 !== sha256) {
        console.error(`MISMATCH ${spec.id}: manifest=${p?.sha256 ?? '<absent>'} generated=${sha256}`);
        process.exitCode = 1;
      }
    }
  }
  const manifest = {
    name: 'lokvis-corpus',
    version: CORPUS_VERSION,
    license: 'CC0-1.0',
    provenance:
      'All images are procedurally generated by corpus/generate.mjs (seeded PRNG, no third-party content); Lokvis dedicates them to the public domain under CC0-1.0.',
    generator: 'benchmark/corpus/generate.mjs',
    imageCount: images.length,
    images,
  };
  if (mode === 'generate') {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Corpus generated: ${images.length} images -> ${imagesDir}`);
  } else if (process.exitCode !== 1) {
    console.log(`Corpus verified: ${images.length} images match manifest sha256.`);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) run(process.argv.includes('--verify') ? 'verify' : 'generate');
