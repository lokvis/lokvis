/**
 * O-15:zod schema 运行时校验测试
 *
 * 验证:
 * - 合法参数通过校验,data 字段携带解析后的值
 * - 类型不匹配(如 width: "100" 字符串)被拦截,返回 MCP error result
 * - 缺少必填字段被拦截
 * - 枚举非法值被拦截
 * - error 文本包含路径与提示,便于 AI 客户端诊断
 */
import { describe, it, expect } from 'vitest';
import { IMAGE_WATERMARK, BUILTIN_CAPABILITIES } from '@lokvis/capability';
import {
  resizeSchema,
  compressSchema,
  convertSchema,
  cropSchema,
  watermarkSchema,
  pdfMergeSchema,
  pdfCompressSchema,
  validateParams,
  WATERMARK_POSITION_VALUES,
} from '../../tools/schemas.js';
import { GENERATED_TOOL_META } from '../../tools/tool-metadata.generated.js';
import { MCP_TOOL_OVERRIDES, resolveToolMeta } from '../../tools/manual-overrides.js';

describe('O-15:zod schema 运行时校验', () => {
  describe('validateParams 通用行为', () => {
    it('合法参数应返回 { success: true, data }', () => {
      const r = validateParams(resizeSchema, {
        input_path: '/a.png',
        width: 100,
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.input_path).toBe('/a.png');
        expect(r.data.width).toBe(100);
      }
    });

    it('未知字段应被 zod 默认 strip(不报错)', () => {
      const r = validateParams(resizeSchema, {
        input_path: '/a.png',
        unknown_field: 'whatever',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect((r.data as Record<string, unknown>).unknown_field).toBeUndefined();
      }
    });

    it('校验失败应返回 { success: false, error } 且 error.isError === true', () => {
      const r = validateParams(resizeSchema, { width: 100 }); // 缺 input_path
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.isError).toBe(true);
        expect(r.error.content).toHaveLength(1);
        expect(r.error.content[0]!.type).toBe('text');
        const text = (r.error.content[0] as { text: string }).text;
        expect(text).toContain('input_path');
      }
    });
  });

  describe('image schemas', () => {
    it('resizeSchema: width 为字符串应被拦截', () => {
      const r = validateParams(resizeSchema, {
        input_path: '/a.png',
        width: '100',
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect((r.error.content[0] as { text: string }).text).toContain('width');
      }
    });

    it('resizeSchema: fit 非法枚举应被拦截', () => {
      const r = validateParams(resizeSchema, {
        input_path: '/a.png',
        fit: 'invalid',
      });
      expect(r.success).toBe(false);
    });

    it('compressSchema: 合法 quality 通过', () => {
      const r = validateParams(compressSchema, {
        input_path: '/a.png',
        quality: 80,
      });
      expect(r.success).toBe(true);
    });

    it('convertSchema: format 缺失应被拦截', () => {
      const r = validateParams(convertSchema, { input_path: '/a.png' });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect((r.error.content[0] as { text: string }).text).toContain('format');
      }
    });

    it('convertSchema: format 非法枚举应被拦截', () => {
      const r = validateParams(convertSchema, {
        input_path: '/a.png',
        format: 'bmp',
      });
      expect(r.success).toBe(false);
    });

    it('cropSchema: x/y/width/height 必须为 number', () => {
      const r = validateParams(cropSchema, {
        input_path: '/a.png',
        x: '10',
        y: 10,
        width: 100,
        height: 50,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect((r.error.content[0] as { text: string }).text).toContain('x');
      }
    });

    it('cropSchema: 合法参数通过', () => {
      const r = validateParams(cropSchema, {
        input_path: '/a.png',
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      });
      expect(r.success).toBe(true);
    });

    it('watermarkSchema: position 非法枚举应被拦截', () => {
      const r = validateParams(watermarkSchema, {
        input_path: '/a.png',
        position: 'middle',
      });
      expect(r.success).toBe(false);
    });

    it('watermarkSchema: position="tile" 合法', () => {
      const r = validateParams(watermarkSchema, {
        input_path: '/a.png',
        position: 'tile',
      });
      expect(r.success).toBe(true);
    });
  });

  describe('pdf schemas', () => {
    it('pdfMergeSchema: input_paths 非数组应被拦截', () => {
      const r = validateParams(pdfMergeSchema, {
        input_paths: '/a.pdf',
      });
      expect(r.success).toBe(false);
    });

    it('pdfMergeSchema: input_paths 数组含非字符串应被拦截', () => {
      const r = validateParams(pdfMergeSchema, {
        input_paths: ['/a.pdf', 123],
      });
      expect(r.success).toBe(false);
    });

    it('pdfMergeSchema: 合法 string[] 通过', () => {
      const r = validateParams(pdfMergeSchema, {
        input_paths: ['/a.pdf', '/b.pdf'],
      });
      expect(r.success).toBe(true);
    });

    it('pdfCompressSchema: level 为字符串应被拦截', () => {
      const r = validateParams(pdfCompressSchema, {
        input_path: '/a.pdf',
        level: '6',
      });
      expect(r.success).toBe(false);
    });

    it('pdfCompressSchema: 合法参数通过', () => {
      const r = validateParams(pdfCompressSchema, {
        input_path: '/a.pdf',
        level: 6,
      });
      expect(r.success).toBe(true);
    });
  });

  describe('与 manifest 一致性', () => {
    it('WATERMARK_POSITION_VALUES 与 IMAGE_WATERMARK.params.position.values 完全一致', () => {
      const positionParam = IMAGE_WATERMARK.params.find(
        (p) => p.name === 'position'
      );
      expect(positionParam).toBeDefined();
      expect(positionParam?.type).toBe('enum');

      const manifestValues: string[] = (positionParam?.values ?? [])
        .slice()
        .sort();
      const schemaValues: string[] = [...WATERMARK_POSITION_VALUES].sort();
      expect(schemaValues).toEqual(manifestValues);
    });
  });
});

/**
 * G4 drift-guard：MCP 工具元数据 ↔ capability 元数据一致性。
 *
 * codegen（scripts/codegen-mcp-tools.ts）从 capability manifests + @lokvis/data-formats
 * 生成 tool-metadata.generated.ts。本组测试守卫三向漂移：
 * 1. generated 工具集 == 从 BUILTIN_CAPABILITIES 派生的期望集（改 manifest 不重跑 codegen → fail）
 * 2. manual-overrides 无孤儿（每个 override 都有对应 generated 条目）
 * 3. 每个已注册工具可解析出非空 description + inputSchema（resolveToolMeta 不会在运行时抛错）
 * 4. data-formats 格式约束确实被消费（image 工具描述含 "Supported image formats"）
 */
describe('G4: MCP 工具元数据 drift-guard', () => {
  // codegen 跳过 developer / archive 域（非 MCP 暴露域）
  const SKIP_DOMAINS = new Set(['developer', 'archive', 'asset']);

  /** 从 capability 元数据派生期望的 (toolName, capability) 集 */
  function expectedTools(): Array<{ name: string; capability: string }> {
    return BUILTIN_CAPABILITIES
      .filter((cap) => cap.mcpExposure !== 'private')
      .filter((cap) => !SKIP_DOMAINS.has(cap.name.split('.')[0]!))
      .map((cap) => ({
        name: cap.mcpToolName ?? `lokvis_${cap.name.replace(/[-.]/g, '_')}`,
        capability: cap.name,
      }));
  }

  it('generated 工具集与 capability 元数据派生集完全一致', () => {
    const genKeys = GENERATED_TOOL_META
      .map((t) => `${t.name}::${t.capability}`)
      .sort();
    const expKeys = expectedTools()
      .map((t) => `${t.name}::${t.capability}`)
      .sort();
    expect(genKeys).toEqual(expKeys);
  });

  it('generated 工具名无重复', () => {
    const names = GENERATED_TOOL_META.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('每个工具名遵循 mcpToolName ?? lokvis_<capability> 约定', () => {
    for (const tool of GENERATED_TOOL_META) {
      const cap = BUILTIN_CAPABILITIES.find((c) => c.name === tool.capability);
      expect(cap, `capability ${tool.capability} 应存在于 BUILTIN_CAPABILITIES`).toBeDefined();
      const expectedName = cap!.mcpToolName ?? `lokvis_${cap!.name.replace(/[-.]/g, '_')}`;
      expect(tool.name).toBe(expectedName);
    }
  });

  it('manual-overrides 无孤儿（每个 override 都有 generated 条目）', () => {
    const genNames = new Set(GENERATED_TOOL_META.map((t) => t.name));
    for (const key of Object.keys(MCP_TOOL_OVERRIDES)) {
      expect(genNames.has(key), `override ${key} 缺少 generated 条目`).toBe(true);
    }
  });

  it('每个已注册工具可解析出非空 description 与 inputSchema', () => {
    for (const key of Object.keys(MCP_TOOL_OVERRIDES)) {
      const meta = resolveToolMeta(GENERATED_TOOL_META, key);
      expect(meta, `${key} 应可解析`).not.toBeNull();
      expect(meta!.name).toBe(key);
      expect(meta!.capability.length).toBeGreaterThan(0);
      expect(meta!.description.length).toBeGreaterThan(0);
      const schema = meta!.inputSchema as { type?: string; properties?: object };
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
    }
  });

  it('data-formats 格式约束被消费（image 工具描述含格式说明）', () => {
    const resize = GENERATED_TOOL_META.find((t) => t.name === 'lokvis_image_resize');
    expect(resize).toBeDefined();
    expect(resize!.description).toContain('Supported image formats');
  });

  it('具体映射锚点：lokvis_image_resize ↔ image.resize', () => {
    const resize = GENERATED_TOOL_META.find((t) => t.name === 'lokvis_image_resize');
    expect(resize?.capability).toBe('image.resize');
  });

  it('manual-overrides inputSchema 枚举值与 Zod schema 一致（防参数漂移）', () => {
    const cases: Array<{
      tool: string;
      prop: string;
      zodEnum: readonly string[];
    }> = [
      { tool: 'lokvis_audio_transcode', prop: 'format', zodEnum: ['mp3', 'wav', 'aac', 'ogg', 'flac'] },
      { tool: 'lokvis_image_resize', prop: 'fit', zodEnum: ['cover', 'contain', 'fill', 'inside', 'outside'] },
      { tool: 'lokvis_image_convert', prop: 'format', zodEnum: ['jpeg', 'png', 'webp', 'avif'] },
    ];
    for (const { tool, prop, zodEnum } of cases) {
      const override = MCP_TOOL_OVERRIDES[tool];
      expect(override, `${tool} override 应存在`).toBeDefined();
      const props = (override!.inputSchema as any).properties;
      const overrideEnum = props?.[prop]?.enum;
      expect(overrideEnum, `${tool}.${prop} override 应有 enum`).toBeDefined();
      expect([...overrideEnum].sort()).toEqual([...zodEnum].sort());
    }
  });
});
