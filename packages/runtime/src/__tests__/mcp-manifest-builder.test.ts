/**
 * mcp-manifest-builder 单元测试(W2.2)
 *
 * 直接测试纯函数 toMcpManifest(capabilities, options, version),不经过
 * Runtime / CapabilityRegistry,聚焦:
 * - mcpExposure 过滤(private / batch-only / public)
 * - JSON Schema 转换边界(color / file / enum / array / object / number min/max)
 * - 默认 tool 名规则与 mcpToolName 覆盖
 * - resources 固定清单
 */
import { describe, it, expect } from 'vitest';
import { toMcpManifest } from '../managers/mcp-manifest-builder.js';
import type {
  Capability,
  CapabilityParam,
} from '@lokvis/schema';

const VERSION = '0.1.0-test';

function makeParam(
  overrides: Partial<CapabilityParam> & { name: string }
): CapabilityParam {
  return { type: 'string', ...overrides };
}

function makeCapability(
  name: string,
  overrides: Partial<Capability> = {}
): Capability {
  return {
    name,
    description: `Capability ${name}`,
    inputTypes: ['image'],
    outputTypes: ['image'],
    params: [],
    performance: 'fast',
    ...overrides,
  };
}

describe('toMcpManifest - 基础结构', () => {
  it('空 capabilities 返回空 tools,但 resources 固定 2 项', () => {
    const manifest = toMcpManifest([], {}, VERSION);
    expect(manifest.serverName).toBe('lokvis');
    expect(manifest.version).toBe(VERSION);
    expect(manifest.tools).toEqual([]);
    expect(manifest.resources).toHaveLength(2);
    expect(manifest.resources.map((r) => r.uri)).toEqual([
      'lokvis://capabilities',
      'lokvis://workflows',
    ]);
    expect(manifest.resources[0]!.mimeType).toBe('application/json');
  });

  it('默认 tool 名为 lokvis_<domain>_<verb>(点号替换为下划线)', () => {
    const cap = makeCapability('image.resize');
    const manifest = toMcpManifest([cap], {}, VERSION);
    expect(manifest.tools[0]!.name).toBe('lokvis_image_resize');
  });

  it('mcpToolName 显式指定时应覆盖默认名', () => {
    const cap = makeCapability('image.compress', {
      mcpToolName: 'lokvis_compress_image',
    });
    const manifest = toMcpManifest([cap], {}, VERSION);
    expect(manifest.tools[0]!.name).toBe('lokvis_compress_image');
  });

  it('tool 携带 description 与 capabilities 字段', () => {
    const cap = makeCapability('pdf.merge', {
      description: 'Merge PDF files',
    });
    const manifest = toMcpManifest([cap], {}, VERSION);
    expect(manifest.tools[0]!.description).toBe('Merge PDF files');
    expect(manifest.tools[0]!.capabilities).toEqual(['pdf.merge']);
  });
});

describe('toMcpManifest - mcpExposure 过滤', () => {
  it('mcpExposure="private" 任何模式都不暴露', () => {
    const cap = makeCapability('image.secret', { mcpExposure: 'private' });
    expect(toMcpManifest([cap], {}, VERSION).tools).toHaveLength(0);
    expect(toMcpManifest([cap], { batchMode: true }, VERSION).tools).toHaveLength(0);
  });

  it('mcpExposure="batch-only" 默认(非 batch)不暴露', () => {
    const cap = makeCapability('image.watermark', { mcpExposure: 'batch-only' });
    expect(toMcpManifest([cap], {}, VERSION).tools).toHaveLength(0);
  });

  it('mcpExposure="batch-only" batchMode=true 时暴露', () => {
    const cap = makeCapability('image.watermark', { mcpExposure: 'batch-only' });
    expect(toMcpManifest([cap], { batchMode: true }, VERSION).tools).toHaveLength(1);
  });

  it('mcpExposure 未设置(默认 public)总是暴露', () => {
    const cap = makeCapability('image.resize');
    expect(toMcpManifest([cap], {}, VERSION).tools).toHaveLength(1);
    expect(toMcpManifest([cap], { batchMode: true }, VERSION).tools).toHaveLength(1);
  });

  it('混合过滤:public + batch-only + private 在 batch 模式下仅剩前两者', () => {
    const caps = [
      makeCapability('a.public'),
      makeCapability('a.batch', { mcpExposure: 'batch-only' }),
      makeCapability('a.private', { mcpExposure: 'private' }),
    ];
    const manifest = toMcpManifest(caps, { batchMode: true }, VERSION);
    expect(manifest.tools).toHaveLength(2);
    expect(manifest.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['lokvis_a_public', 'lokvis_a_batch'])
    );
  });
});

describe('toMcpManifest - JSON Schema 转换边界', () => {
  function schemaOf(cap: Capability): Record<string, unknown> {
    const manifest = toMcpManifest([cap], {}, VERSION);
    return manifest.tools[0]!.inputSchema as Record<string, unknown>;
  }

  it('required 字段应进入 JSON Schema required 数组', () => {
    const cap = makeCapability('x.test', {
      params: [
        makeParam({ name: 'width', type: 'number', required: true }),
        makeParam({ name: 'optional', type: 'string' }),
      ],
    });
    const schema = schemaOf(cap);
    expect(schema.required).toEqual(['width']);
  });

  it('number 类型应附加 minimum/maximum(min/max 存在时)', () => {
    const cap = makeCapability('x.test', {
      params: [makeParam({ name: 'w', type: 'number', min: 1, max: 100 })],
    });
    const prop = (schemaOf(cap).properties as Record<string, Record<string, unknown>>).w!;
    expect(prop.type).toBe('number');
    expect(prop.minimum).toBe(1);
    expect(prop.maximum).toBe(100);
  });

  it('string 类型不应附加 minimum/maximum(即便 min/max 存在)', () => {
    const cap = makeCapability('x.test', {
      params: [makeParam({ name: 't', type: 'string', min: 1, max: 100 })],
    });
    const prop = (schemaOf(cap).properties as Record<string, Record<string, unknown>>).t!;
    expect(prop).not.toHaveProperty('minimum');
    expect(prop).not.toHaveProperty('maximum');
  });

  it('color 类型 → { type: string, format: color }', () => {
    const cap = makeCapability('x.test', {
      params: [makeParam({ name: 'bg', type: 'color' })],
    });
    const prop = (schemaOf(cap).properties as Record<string, Record<string, unknown>>).bg!;
    expect(prop.type).toBe('string');
    expect(prop.format).toBe('color');
  });

  it('file 类型 → { type: string }(非非法的 "file" 类型)', () => {
    const cap = makeCapability('x.test', {
      params: [makeParam({ name: 'src', type: 'file' })],
    });
    const prop = (schemaOf(cap).properties as Record<string, Record<string, unknown>>).src!;
    expect(prop.type).toBe('string');
    expect(prop).not.toHaveProperty('format');
  });

  it('enum 类型 → { type: string, enum: values }', () => {
    const cap = makeCapability('x.test', {
      params: [makeParam({ name: 'fmt', type: 'enum', values: ['png', 'webp'] })],
    });
    const prop = (schemaOf(cap).properties as Record<string, Record<string, unknown>>).fmt!;
    expect(prop.type).toBe('string');
    expect(prop.enum).toEqual(['png', 'webp']);
  });

  it('array 类型应递归映射 items(color items → string + format)', () => {
    const cap = makeCapability('x.test', {
      params: [makeParam({ name: 'colors', type: 'array', items: 'color' })],
    });
    const prop = (schemaOf(cap).properties as Record<string, Record<string, unknown>>).colors!;
    expect(prop.type).toBe('array');
    expect(prop.items).toMatchObject({ type: 'string', format: 'color' });
  });

  it('array + enum items → items.type 为 string(enum 由外层处理)', () => {
    const cap = makeCapability('x.test', {
      params: [makeParam({ name: 'list', type: 'array', items: 'enum' })],
    });
    const prop = (schemaOf(cap).properties as Record<string, Record<string, unknown>>).list!;
    expect(prop.type).toBe('array');
    expect((prop.items as Record<string, unknown>).type).toBe('string');
  });

  it('object/boolean 类型保持同名 JSON Schema 类型', () => {
    const cap = makeCapability('x.test', {
      params: [
        makeParam({ name: 'opts', type: 'object' }),
        makeParam({ name: 'flag', type: 'boolean', default: false }),
      ],
    });
    const props = schemaOf(cap).properties as Record<string, Record<string, unknown>>;
    expect(props.opts!.type).toBe('object');
    expect(props.flag!.type).toBe('boolean');
    expect(props.flag!.default).toBe(false);
  });

  it('description 与 default 应透传到 property', () => {
    const cap = makeCapability('x.test', {
      params: [
        makeParam({
          name: 'q',
          type: 'number',
          description: 'Quality',
          default: 80,
        }),
      ],
    });
    const prop = (schemaOf(cap).properties as Record<string, Record<string, unknown>>).q!;
    expect(prop.description).toBe('Quality');
    expect(prop.default).toBe(80);
  });

  it('无 required 参数时 schema 不含 required 字段', () => {
    const cap = makeCapability('x.test', {
      params: [makeParam({ name: 'a', type: 'string' })],
    });
    expect(schemaOf(cap)).not.toHaveProperty('required');
  });
});
