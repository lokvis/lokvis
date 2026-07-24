/**
 * WASM 编码器配置测试（configureWasmEncoders / resolveAvifWasmUrl / wasmEncodersEnabled）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  configureWasmEncoders,
  resolveAvifWasmUrl,
  wasmEncodersEnabled,
  resetWasmEncoderConfig,
} from '../wasm-config.js';
import { ENGINE_IMAGE_VERSION } from '../wasm/wasm-asset-version.generated.js';

// 读取本包 package.json 版本,用于校验默认 URL 的版本锁定(D4)
const pkgVersion = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
).version as string;

beforeEach(() => {
  resetWasmEncoderConfig();
});

describe('wasm-config', () => {
  it('默认启用且指向 jsdelivr CDN', () => {
    expect(wasmEncodersEnabled()).toBe(true);
    expect(resolveAvifWasmUrl()).toContain('cdn.jsdelivr.net');
    expect(resolveAvifWasmUrl()).toContain('avif.wasm');
  });

  it('默认 URL 版本锁定到 package.json 版本(D4:防止 glue/wasm ABI 漂移)', () => {
    expect(resolveAvifWasmUrl()).toBe(
      `https://cdn.jsdelivr.net/npm/@lokvis/engine-image@${pkgVersion}/dist/wasm/avif.wasm`
    );
  });

  it('生成的版本常量与 package.json 保持同步(版本变更后需重跑 pnpm codegen)', () => {
    expect(ENGINE_IMAGE_VERSION).toBe(pkgVersion);
  });

  it('avifUrl 覆盖为自托管路径', () => {
    configureWasmEncoders({ avifUrl: '/wasm/avif.wasm' });
    expect(resolveAvifWasmUrl()).toBe('/wasm/avif.wasm');
    expect(wasmEncodersEnabled()).toBe(true);
  });

  it('enabled:false 整体关闭兜底', () => {
    configureWasmEncoders({ enabled: false });
    expect(wasmEncodersEnabled()).toBe(false);
  });

  it('字段级合并：只传 enabled 不影响已配置的 avifUrl', () => {
    configureWasmEncoders({ avifUrl: '/wasm/avif.wasm' });
    configureWasmEncoders({ enabled: false });
    expect(resolveAvifWasmUrl()).toBe('/wasm/avif.wasm');
    expect(wasmEncodersEnabled()).toBe(false);
  });

  it('resetWasmEncoderConfig 恢复默认', () => {
    configureWasmEncoders({ avifUrl: '/x.wasm', enabled: false });
    resetWasmEncoderConfig();
    expect(wasmEncodersEnabled()).toBe(true);
    expect(resolveAvifWasmUrl()).toContain('cdn.jsdelivr.net');
  });
});
