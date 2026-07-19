/**
 * CLI 版本号
 *
 * 从 package.json 动态读取,避免与 package.json 的 version 字段漂移。
 * 通过 import.meta.url 定位当前模块路径,无论是 src/ 还是 dist/ 都能找到
 * 紧邻的 package.json(src/version.ts → ../package.json;
 * dist/version.js → ../package.json)。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', 'package.json');

let version: string;
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
  version = pkg.version ?? '0.0.0-unknown';
} catch {
  // 极端情况(package.json 缺失或损坏)给出可识别占位值,避免抛错导致 CLI 不可用
  version = '0.0.0-unknown';
}

export { version };
