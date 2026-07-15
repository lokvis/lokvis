/**
 * CLI `run` 命令集成测试:真实跑 image.resize(W20.4)
 *
 * 与 `../commands/run.test.ts`(单测)的区别:
 * - 单测用 vi.mock 替换 createLokvis 与 imageToolsPluginNode,只验证
 *   选项解析、插件注入顺序、--output 错误分支等纯逻辑行为。
 * - 本集成测试用 **真实** createLokvis + 真实 imageToolsPluginNode
 *   (sharp 引擎,M2.2 实装),验证 CLI 入口的端到端可用性:
 *   解析 JSON → 校验 → 创建 runtime → importAsset → run(image.resize)
 *   → exportAsset → 写入 --output 文件。
 *
 * 验收标准(对应 W20.4):
 * - 200x100 PNG → resize(width=100,保持纵横比) → 输出 100x50 PNG
 * - --output 文件真实写入磁盘,可被 sharp 再次解码
 * - 未指定 --output 时工作流也能成功执行(只是不写文件)
 *
 * 依赖:
 * - @lokvis/plugin-image/dist、@lokvis/sdk/dist、@lokvis/runtime/dist
 *   (由根 `pnpm build` 生成;CI 应在 test 前 build)
 * - sharp native binary(已加到 cli devDependencies)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { runWorkflow } from '../../commands/run.js';

describe('CLI run 命令集成测试:真实跑 image.resize', () => {
  let tmpDir: string;
  let inputPath: string;
  let wfPath: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'lokvis-cli-integration-'));
    // 生成 200x100 红色 PNG 作为输入
    const pngBuf = await sharp({
      create: { width: 200, height: 100, channels: 3, background: '#ff0000' },
    })
      .png()
      .toBuffer();
    inputPath = join(tmpDir, 'input.png');
    await writeFile(inputPath, pngBuf);

    // 单 transform 节点的 resize workflow(load/export 节点 capability 可选,
    // 此处省略,executor 会把输入 asset 直接喂给 transform 节点)
    wfPath = join(tmpDir, 'resize.json');
    await writeFile(
      wfPath,
      JSON.stringify({
        id: 'wf-int-resize',
        version: '1.0.0',
        name: 'Integration Resize',
        description: 'CLI integration test for W20.4',
        author: { id: 'cli', name: 'integration' },
        category: 'image',
        tags: ['resize', 'integration'],
        nodes: [
          {
            id: 'n-resize',
            type: 'transform',
            capability: 'image.resize',
            params: { width: 100 },
          },
        ],
        edges: [],
        inputs: { type: 'image', multiple: false },
        outputs: { type: 'image', format: 'png' },
      }),
      'utf-8'
    );
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('应通过 sharp 引擎把 200x100 PNG resize 为 100x50 PNG 并写入 --output', async () => {
    const outputPath = join(tmpDir, 'output.png');
    const result = await runWorkflow(wfPath, [inputPath], { output: outputPath });

    // 工作流执行成功,产出一个输出 Asset
    expect(result.status).toBe('completed');
    expect(result.outputs.length).toBe(1);

    // --output 文件应已写入磁盘
    expect(existsSync(outputPath)).toBe(true);

    // 输出 PNG 应可被 sharp 解码,尺寸为 100x50(保持纵横比:200x100 → 100x50)
    const outBuf = await readFile(outputPath);
    const meta = await sharp(outBuf).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(50);
    expect(meta.format).toBe('png');
  });

  it('未指定 --output 时也应成功执行工作流(只不写文件)', async () => {
    const result = await runWorkflow(wfPath, [inputPath]);
    expect(result.status).toBe('completed');
    expect(result.outputs.length).toBe(1);
  });

  it('compress 操作也应真实跑通(sharp 引擎)', async () => {
    // 验证 sharp 引擎不只 resize 可用,compress 也能跑(quality 降级 → 输出更小)
    const compressWfPath = join(tmpDir, 'compress.json');
    await writeFile(
      compressWfPath,
      JSON.stringify({
        id: 'wf-int-compress',
        version: '1.0.0',
        name: 'Integration Compress',
        description: 'CLI integration test for W20.4 — compress',
        author: { id: 'cli', name: 'integration' },
        category: 'image',
        tags: ['compress', 'integration'],
        nodes: [
          {
            id: 'n-compress',
            type: 'transform',
            capability: 'image.compress',
            params: { format: 'jpeg', quality: 50 },
          },
        ],
        edges: [],
        inputs: { type: 'image', multiple: false },
        outputs: { type: 'image', format: 'jpeg' },
      }),
      'utf-8'
    );

    const outputPath = join(tmpDir, 'output.jpg');
    const result = await runWorkflow(compressWfPath, [inputPath], {
      output: outputPath,
    });

    expect(result.status).toBe('completed');
    expect(result.outputs.length).toBe(1);
    expect(existsSync(outputPath)).toBe(true);

    // 输出应为 JPEG 格式
    const outBuf = await readFile(outputPath);
    const meta = await sharp(outBuf).metadata();
    expect(meta.format).toBe('jpeg');
  });
});
