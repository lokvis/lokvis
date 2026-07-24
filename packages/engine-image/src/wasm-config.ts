/**
 * WASM 编码器配置（设计文档 docs/reports/20260724-engine-wasm-avif-encoder.md D4）
 *
 * 纯 tsc 构建无法内联 .wasm 二进制，编码器二进制走运行时 fetch：
 * - 默认 URL 指向发布包的 jsdelivr 公共 CDN，**版本锁定**到本包 version
 *   （wasm 资产随 npm 包 dist/wasm/ 发布）——确保 glue 代码与 wasm 二进制
 *   同版本，升级 @jsquash/avif 时不产生 ABI 漂移
 * - 消费方可 configureWasmEncoders({ avifUrl }) 覆盖为自托管路径
 * - enabled: false 整体关闭 wasm 兜底（bundle 敏感消费方），avif 回退到
 *   canvas 原生语义（不支持时 throw，上层用 detectFormatSupport 门控）
 */

import { ENGINE_IMAGE_VERSION } from './wasm/wasm-asset-version.generated.js';

export interface WasmEncoderConfig {
  /** AVIF 编码器 wasm 二进制 URL；默认走 jsdelivr 公共 CDN（版本锁定） */
  avifUrl?: string;
  /** 整体禁用 wasm 兜底（默认启用） */
  enabled?: boolean;
}

const DEFAULT_AVIF_WASM_URL = `https://cdn.jsdelivr.net/npm/@lokvis/engine-image@${ENGINE_IMAGE_VERSION}/dist/wasm/avif.wasm`;

let avifUrlOverride: string | undefined;
let enabled = true;

/** 配置 WASM 编码器（字段级合并，未传字段保持现值） */
export function configureWasmEncoders(config: WasmEncoderConfig): void {
  if (config.avifUrl !== undefined) {
    avifUrlOverride = config.avifUrl;
  }
  if (config.enabled !== undefined) {
    enabled = config.enabled;
  }
}

/** 解析 AVIF wasm 二进制 URL（消费方覆盖优先） */
export function resolveAvifWasmUrl(): string {
  return avifUrlOverride ?? DEFAULT_AVIF_WASM_URL;
}

/** wasm 兜底是否启用（纯配置查询，不含环境探测；环境判定在 encodeSmart） */
export function wasmEncodersEnabled(): boolean {
  return enabled;
}

/** 重置为默认配置（仅测试使用） */
export function resetWasmEncoderConfig(): void {
  avifUrlOverride = undefined;
  enabled = true;
}
