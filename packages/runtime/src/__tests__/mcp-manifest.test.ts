/**
 * Runtime.toMcpManifest() 单元测试
 *
 * 验证:
 * - 把已注册 Capability 转为 MCP tool manifest
 * - mcpExposure='private' 不暴露
 * - mcpToolName 覆盖默认 tool 名
 * - inputSchema 从 CapabilityParam[] 正确生成
 * - resources 固定为 capabilities 与 workflows 两个清单
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { LokvisRuntimeImpl } from '../runtime.js';
import { createMemoryAssetStore } from '../asset-store.js';
import type { Capability, CapabilityImplementation } from '@lokvis/schema';

function makeCapability(
  name: string,
  overrides: Partial<Capability> = {}
): Capability {
  return {
    name,
    description: `Capability ${name}`,
    inputTypes: ['image'],
    outputTypes: ['image'],
    params: [
      { name: 'width', type: 'number', required: true, min: 1, max: 10000 },
      { name: 'format', type: 'enum', values: ['png', 'webp'], description: 'Output format' },
    ],
    performance: 'fast',
    ...overrides,
  };
}

function makeImpl(capability: string): CapabilityImplementation {
  return { capability, engine: 'fake', execute: async () => [] };
}

describe('LokvisRuntimeImpl.toMcpManifest()', () => {
  let runtime: LokvisRuntimeImpl;

  beforeEach(() => {
    runtime = new LokvisRuntimeImpl({
      assetStore: createMemoryAssetStore(),
    });
  });

  it('应把已注册 Capability 转为 MCP tool', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(makeCapability('image.resize'));
    reg.registerImplementation(makeImpl('image.resize'));

    const manifest = runtime.toMcpManifest();

    expect(manifest.serverName).toBe('lokvis');
    expect(manifest.version).toBe(runtime.version);
    expect(manifest.tools).toHaveLength(1);
    expect(manifest.tools[0]!.name).toBe('lokvis_image_resize');
    expect(manifest.tools[0]!.description).toBe('Capability image.resize');
    expect(manifest.tools[0]!.capabilities).toEqual(['image.resize']);
  });

  it('默认 tool 名为 lokvis_<domain>_<verb>(下划线替换点号)', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(makeCapability('pdf.merge'));
    reg.registerImplementation(makeImpl('pdf.merge'));

    const manifest = runtime.toMcpManifest();
    expect(manifest.tools[0]!.name).toBe('lokvis_pdf_merge');
  });

  it('mcpToolName 显式指定时应覆盖默认名', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(
      makeCapability('image.compress', { mcpToolName: 'lokvis_compress_image' })
    );
    reg.registerImplementation(makeImpl('image.compress'));

    const manifest = runtime.toMcpManifest();
    expect(manifest.tools[0]!.name).toBe('lokvis_compress_image');
  });

  it('mcpExposure="private" 的 capability 不应出现在 tools 列表', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(makeCapability('image.resize', { mcpExposure: 'public' }));
    reg.registerCapability(makeCapability('image.secret', { mcpExposure: 'private' }));
    reg.registerImplementation(makeImpl('image.resize'));
    reg.registerImplementation(makeImpl('image.secret'));

    const manifest = runtime.toMcpManifest();
    expect(manifest.tools).toHaveLength(1);
    expect(manifest.tools[0]!.name).toBe('lokvis_image_resize');
  });

  it('inputSchema 应从 CapabilityParam[] 正确生成(required / min / max / enum)', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(makeCapability('image.resize'));
    reg.registerImplementation(makeImpl('image.resize'));

    const manifest = runtime.toMcpManifest();
    const schema = manifest.tools[0]!.inputSchema as {
      type: string;
      properties: Record<string, Record<string, unknown>>;
      required: string[];
    };

    expect(schema.type).toBe('object');
    expect(schema.properties.width).toMatchObject({
      type: 'number',
      minimum: 1,
      maximum: 10000,
    });
    expect(schema.properties.format).toMatchObject({
      type: 'enum',
      enum: ['png', 'webp'],
      description: 'Output format',
    });
    expect(schema.required).toEqual(['width']);
  });

  it('resources 固定为 capabilities 与 workflows 两个清单', () => {
    const manifest = runtime.toMcpManifest();
    expect(manifest.resources).toHaveLength(2);
    expect(manifest.resources.map((r) => r.uri)).toEqual([
      'lokvis://capabilities',
      'lokvis://workflows',
    ]);
    expect(manifest.resources[0]!.mimeType).toBe('application/json');
  });

  it('未注册任何 capability 时应返回空 tools 列表', () => {
    const manifest = runtime.toMcpManifest();
    expect(manifest.tools).toEqual([]);
    // 但 resources 仍存在(固定清单)
    expect(manifest.resources).toHaveLength(2);
  });
});
