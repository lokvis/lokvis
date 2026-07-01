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

  it('mcpExposure="batch-only" 在默认(非 batch)模式下不应暴露(B3)', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(makeCapability('image.resize', { mcpExposure: 'public' }));
    reg.registerCapability(
      makeCapability('image.watermark', { mcpExposure: 'batch-only' })
    );
    reg.registerImplementation(makeImpl('image.resize'));
    reg.registerImplementation(makeImpl('image.watermark'));

    // 默认 batchMode=false:batch-only 不暴露
    const manifest = runtime.toMcpManifest();
    expect(manifest.tools).toHaveLength(1);
    expect(manifest.tools[0]!.name).toBe('lokvis_image_resize');
  });

  it('mcpExposure="batch-only" 在 batchMode=true 时应暴露(B3)', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(makeCapability('image.resize', { mcpExposure: 'public' }));
    reg.registerCapability(
      makeCapability('image.watermark', { mcpExposure: 'batch-only' })
    );
    reg.registerImplementation(makeImpl('image.resize'));
    reg.registerImplementation(makeImpl('image.watermark'));

    // batchMode=true:public + batch-only 都暴露
    const manifest = runtime.toMcpManifest({ batchMode: true });
    expect(manifest.tools).toHaveLength(2);
    const names = manifest.tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['lokvis_image_resize', 'lokvis_image_watermark'])
    );
  });

  it('mcpExposure="private" 在 batchMode=true 时仍不暴露(B3)', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(
      makeCapability('image.watermark', { mcpExposure: 'batch-only' })
    );
    reg.registerCapability(makeCapability('image.secret', { mcpExposure: 'private' }));
    reg.registerImplementation(makeImpl('image.watermark'));
    reg.registerImplementation(makeImpl('image.secret'));

    const manifest = runtime.toMcpManifest({ batchMode: true });
    // batch-only 暴露,private 仍不暴露
    expect(manifest.tools).toHaveLength(1);
    expect(manifest.tools[0]!.name).toBe('lokvis_image_watermark');
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
    // enum 类型映射为合法 JSON Schema:{ type:'string', enum:[...] }
    // (CapabilityParamType 'enum' 不是合法 JSON Schema 类型,见 B2 修复)
    expect(schema.properties.format).toMatchObject({
      type: 'string',
      enum: ['png', 'webp'],
      description: 'Output format',
    });
    expect(schema.required).toEqual(['width']);
  });

  it('color/file/object 类型应映射为合法 JSON Schema 类型(B2)', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(
      makeCapability('image.adjust', {
        params: [
          { name: 'bg', type: 'color', description: 'Background color' },
          { name: 'src', type: 'file', description: 'Source file path' },
          { name: 'opts', type: 'object', description: 'Extra options' },
          { name: 'flag', type: 'boolean', default: false },
        ],
      })
    );
    reg.registerImplementation(makeImpl('image.adjust'));

    const manifest = runtime.toMcpManifest();
    const schema = manifest.tools[0]!.inputSchema as {
      type: string;
      properties: Record<string, Record<string, unknown>>;
    };

    // color → { type:'string', format:'color' }(非 'color' 非法类型)
    expect(schema.properties.bg).toMatchObject({
      type: 'string',
      format: 'color',
      description: 'Background color',
    });
    // file → { type:'string' }(非 'file' 非法类型)
    expect(schema.properties.src).toMatchObject({
      type: 'string',
      description: 'Source file path',
    });
    // object → { type:'object' }(已是合法 JSON Schema 类型)
    expect(schema.properties.opts).toMatchObject({
      type: 'object',
      description: 'Extra options',
    });
    // boolean → { type:'boolean' }
    expect(schema.properties.flag).toMatchObject({ type: 'boolean' });
  });

  it('array 类型应递归映射 items(B2):items=color 时 items.type 为 string', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(
      makeCapability('image.tint', {
        params: [
          {
            name: 'colors',
            type: 'array',
            items: 'color',
            description: 'Colors to apply',
          },
        ],
      })
    );
    reg.registerImplementation(makeImpl('image.tint'));

    const manifest = runtime.toMcpManifest();
    const schema = manifest.tools[0]!.inputSchema as {
      properties: Record<string, Record<string, unknown>>;
    };
    const colors = schema.properties.colors!;
    expect(colors.type).toBe('array');
    // items 应为完整 schema 且 type 为合法类型(color → string + format)
    expect(colors.items).toMatchObject({ type: 'string', format: 'color' });
  });

  it('number 之外的类型不应附加 minimum/maximum(B2)', () => {
    const reg = runtime._getCapabilityRegistry();
    reg.registerCapability(
      makeCapability('image.label', {
        params: [
          // string 的 min/max 在 JSON Schema 中应为 minLength/maxLength,
          // CapabilityParam 仅定义数值语义的 min/max,故只对 number 应用
          { name: 'text', type: 'string', min: 1, max: 100 },
        ],
      })
    );
    reg.registerImplementation(makeImpl('image.label'));

    const manifest = runtime.toMcpManifest();
    const schema = manifest.tools[0]!.inputSchema as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(schema.properties.text).not.toHaveProperty('minimum');
    expect(schema.properties.text).not.toHaveProperty('maximum');
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
