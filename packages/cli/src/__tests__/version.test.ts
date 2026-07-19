/**
 * CLI 版本号测试
 *
 * 验证 version 从 package.json 动态读取,与 package.json 的 version 字段保持同步,
 * 不再硬编码(S1 P0:修复版本号漂移 bug)。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { version } from '../version.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };

describe('version 常量', () => {
  it('应为非空字符串', () => {
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  it('应符合 semver 格式', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('应与 package.json 的 version 字段一致(不漂移)', () => {
    expect(version).toBe(pkg.version);
  });
});
