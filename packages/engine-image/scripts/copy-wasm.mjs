/**
 * copy-wasm.mjs — 构建后拷贝 AVIF WASM 二进制到 dist/wasm/
 *
 * 背景(见 docs/reports/20260724-engine-wasm-avif-encoder.md §4.3):
 * engine-image 是纯 tsc 构建,无法内联 .wasm 资源。运行时通过
 * `fetch(resolveAvifWasmUrl())` 加载,默认指向 jsdelivr 上本包
 * `dist/wasm/avif.wasm` 的发布产物。因此发布物必须包含该文件:
 *
 *   node_modules/@jsquash/avif/codec/enc/avif_enc.wasm
 *     → dist/wasm/avif.wasm
 *
 * 只拷贝单线程版(D6:显式绕过 mt 自动选择,避免 COOP/COEP 依赖);
 * 解码器不拷贝(本包仅编码侧需要 WASM 兜底)。
 *
 * 失败语义:wasm 缺失时以非零码退出,阻断构建——
 * 宁可构建失败也不发布缺少兜底编码器的包。
 */
import { createRequire } from 'node:module';
import { copyFile, mkdir } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const source = require.resolve('@jsquash/avif/codec/enc/avif_enc.wasm');
const targetDir = path.join(pkgDir, 'dist', 'wasm');
const target = path.join(targetDir, 'avif.wasm');

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);

const { size } = await stat(target);
console.log(`[copy-wasm] ${path.relative(pkgDir, target)} (${(size / 1024 / 1024).toFixed(2)} MB)`);
