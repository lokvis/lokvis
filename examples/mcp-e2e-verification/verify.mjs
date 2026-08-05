#!/usr/bin/env node
/**
 * Lokvis MCP Server 端到端验证脚本(M2.4 可复现 demo)。
 *
 * 流程:
 *   1. 创建临时 workdir,生成一张测试 PNG(200×100 红色)
 *   2. 在随机端口启动 Lokvis MCP server(SSE 模式,仅 image 域)
 *   3. 用 @modelcontextprotocol/sdk 的 Client + SSEClientTransport 连接
 *   4. listTools → 断言 3 个 lokvis_image_* tool 已注册
 *   5. callTool lokvis_image_resize   → 断言输出文件尺寸正确
 *   6. callTool lokvis_image_compress → 断言输出文件存在且更小
 *   7. callTool lokvis_image_convert  → 断言输出格式为 webp
 *   8. 打印汇总,关闭 client + server + 临时目录
 *
 * 退出码:0 全绿 / 1 任一断言失败。
 *
 * 用法:
 *   pnpm build                  # 先构建 @lokvis/mcp-server dist
 *   pnpm --filter @lokvis/example-mcp-e2e-verification verify
 */

import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import sharp from 'sharp';
import { createLokvisMcpServer } from '@lokvis/mcp-server';

/** ANSI 颜色码(无依赖,失败红 / 通过绿 / 信息灰) */
const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/** 单条断言:失败立即抛错,让 try/catch 捕获并标记。 */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** 步骤结果记录,用于最终汇总打印 */
const results = [];
function recordStep(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok ? c.green('✓ PASS') : c.red('✗ FAIL');
  console.log(`  ${tag}  ${name}`);
  if (detail) console.log(c.dim(`          ${detail}`));
}

async function main() {
  console.log(c.bold('\n=== Lokvis MCP Server 端到端验证(M2.4 demo)===\n'));

  // ── 1. 准备临时 workdir + 测试图片 ──────────────────────────────
  const workdir = await mkdtemp(join(tmpdir(), 'lokvis-e2e-'));
  const inputPath = join(workdir, 'sample.png');
  // 200×100 红色 PNG,后续 resize 期望 → 100×50
  await sharp({
    create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toFile(inputPath);
  console.log(c.dim(`workdir: ${workdir}`));
  console.log(c.dim(`sample:  ${inputPath} (200×100 PNG)\n`));

  let client;
  let sseServer;
  let bridge;
  try {
    // ── 2. 启动 MCP server(SSE 模式,随机端口) ────────────────────
    //    domains: ['image'] — 仅启用 image 域 tool(当前已实装的全部)
    const { server, bridge: b } = await createLokvisMcpServer({
      workdir,
      domains: ['image'],
      mode: 'sse',
      port: 0, // 随机端口
    });
    bridge = b;
    sseServer = await server.startSse(0);
    const port = sseServer.getPort();
    console.log(c.dim(`mcp-server SSE 监听 http://127.0.0.1:${port}/sse`));
    console.log(c.dim(`已注册 tools: ${server.getRegisteredToolNames().join(', ')}\n`));

    // ── 3. SDK Client 连接 ──────────────────────────────────────
    client = new Client(
      { name: 'lokvis-e2e-verifier', version: '0.1.0' },
      { capabilities: {} }
    );
    await client.connect(new SSEClientTransport(new URL(`http://127.0.0.1:${port}/sse`)));
    console.log(c.bold('步骤 1: listTools(验证 3 个 image tool 已注册)\n'));

    // ── 4. listTools 断言 ───────────────────────────────────────
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).sort();
      const expected = [
        'lokvis_image_compress',
        'lokvis_image_convert',
        'lokvis_image_resize',
      ];
      assert(
        expected.every((n) => names.includes(n)),
        `缺少 tool,期望包含 ${expected.join(', ')},实际 ${names.join(', ')}`
      );
      assert(tools.length >= 3, `tool 数量不足,期望 ≥3,实际 ${tools.length}`);
      recordStep(
        'listTools 返回 3 个 lokvis_image_* tool',
        true,
        `tools = [${names.join(', ')}]`
      );
    } catch (err) {
      recordStep('listTools 返回 3 个 lokvis_image_* tool', false, err.message);
      throw err;
    }

    // ── 5. lokvis_image_resize ─────────────────────────────────
    console.log(c.bold('\n步骤 2: callTool lokvis_image_resize(200×100 → 100×50)\n'));
    try {
      const result = await client.callTool({
        name: 'lokvis_image_resize',
        arguments: { input_path: inputPath, width: 100 },
      });
      assert(!result.isError, `tool 返回 isError: ${JSON.stringify(result.content)}`);
      const text = result.content[0]?.text ?? '';
      assert(text.includes('100x50'), `结果文本未含 100x50: ${text}`);
      const outPath = join(workdir, 'sample_resized.png');
      const meta = await sharp(outPath).metadata();
      assert(meta.width === 100, `输出 width 期望 100,实际 ${meta.width}`);
      assert(meta.height === 50, `输出 height 期望 50,实际 ${meta.height}`);
      recordStep('resize 输出尺寸 100×50', true, text.split('\n').join(' | '));
    } catch (err) {
      recordStep('resize 输出尺寸 100×50', false, err.message);
      throw err;
    }

    // ── 6. lokvis_image_compress ───────────────────────────────
    console.log(c.bold('\n步骤 3: callTool lokvis_image_compress(quality 30)\n'));
    try {
      const result = await client.callTool({
        name: 'lokvis_image_compress',
        arguments: { input_path: inputPath, quality: 30 },
      });
      assert(!result.isError, `tool 返回 isError: ${JSON.stringify(result.content)}`);
      const text = result.content[0]?.text ?? '';
      assert(text.includes('compressed'), `结果文本未含 compressed: ${text}`);
      const outPath = join(workdir, 'sample_compressed.png');
      await access(outPath);
      recordStep('compress 输出文件已生成', true, text.split('\n').join(' | '));
    } catch (err) {
      recordStep('compress 输出文件已生成', false, err.message);
      throw err;
    }

    // ── 7. lokvis_image_convert ────────────────────────────────
    console.log(c.bold('\n步骤 4: callTool lokvis_image_convert(PNG → WebP)\n'));
    try {
      const result = await client.callTool({
        name: 'lokvis_image_convert',
        arguments: { input_path: inputPath, format: 'webp' },
      });
      assert(!result.isError, `tool 返回 isError: ${JSON.stringify(result.content)}`);
      const text = result.content[0]?.text ?? '';
      assert(text.includes('converted'), `结果文本未含 converted: ${text}`);
      const outPath = join(workdir, 'sample_converted.webp');
      const meta = await sharp(outPath).metadata();
      assert(meta.format === 'webp', `输出 format 期望 webp,实际 ${meta.format}`);
      recordStep('convert 输出格式为 webp', true, text.split('\n').join(' | '));
    } catch (err) {
      recordStep('convert 输出格式为 webp', false, err.message);
      throw err;
    }

    // ── 8. 汇总 ────────────────────────────────────────────────
    const allOk = results.every((r) => r.ok);
    console.log(c.bold('\n=== 汇总 ===\n'));
    for (const r of results) {
      const tag = r.ok ? c.green('✓') : c.red('✗');
      console.log(`  ${tag} ${r.name}`);
    }
    console.log('');
    if (allOk) {
      console.log(c.green(c.bold('✓ M2.4 端到端验证通过:3 个 image tool 全部正常工作\n')));
    } else {
      console.log(c.red(c.bold('✗ M2.4 端到端验证失败\n')));
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(c.red(`\nFatal: ${err.message}\n`));
    process.exitCode = 1;
  } finally {
    // ── 9. 清理资源 ────────────────────────────────────────────
    if (client) await client.close().catch((err) => console.debug("client.close failed:", err));
    if (sseServer) await sseServer.close().catch((err) => console.debug("sseServer.close failed:", err));
    if (bridge) await bridge.close().catch((err) => console.debug("bridge.close failed:", err));
    await rm(workdir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(c.red(`\nUnexpected fatal: ${err.stack ?? err}\n`));
  process.exit(1);
});
