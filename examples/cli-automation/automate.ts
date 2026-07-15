/**
 * CLI 自动化示例(W20.6)
 *
 * 演示如何在 Node.js / CI 脚本中编程式调用 @lokvis/cli:
 * 1. 列出内置能力(runCLI(['capabilities']))
 * 2. 真实跑 image.resize:用 sharp 生成测试图 → runWorkflow resize → 验证输出
 *
 * Node 端图像能力:自 M2.2 起,@lokvis/cli 的 run 命令默认注入
 * imageToolsPluginNode(sharp 引擎),让 image.resize / compress / convert /
 * crop / watermark 在 Node 中真实可执行(无需浏览器 Canvas)。
 *
 * 运行:
 *   pnpm --filter @lokvis/example-cli-automation start
 *   # 或
 *   npx tsx examples/cli-automation/automate.ts
 */
import { runCLI, runWorkflow } from '@lokvis/cli';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

/** 构造一个最小 resize workflow(load/export 节点省略,executor 直接把输入喂给 transform) */
const resizeWorkflow = {
  id: 'ci-resize-workflow',
  version: '1.0.0',
  name: 'CI Resize',
  description: 'Resize image to 1280x720 (cover fit) for OG preview',
  author: { id: 'ci', name: 'CLI Automation' },
  category: 'image',
  tags: ['resize', 'ci'],
  nodes: [
    {
      id: 'n-resize',
      type: 'transform' as const,
      capability: 'image.resize',
      params: { width: 1280, height: 720, fit: 'cover' },
      label: 'Resize',
    },
  ],
  edges: [],
  inputs: { type: 'image' as const, multiple: false, accept: ['image/*'] },
  outputs: { type: 'image' as const, format: 'png' },
};

async function main(): Promise<void> {
  console.log('=== 1. 列出内置能力(runCLI capabilities) ===');
  // runCLI 直接写入 process.stdout,这里复用同一入口
  await runCLI(['capabilities']);
  console.log();

  console.log('=== 2. 真实跑 image.resize(sharp 引擎) ===');
  // 准备工作目录
  const workDir = join(tmpdir(), 'lokvis-cli-automation');
  await mkdir(workDir, { recursive: true });

  // 用 sharp 生成 1920x1080 测试图(模拟原始素材)
  const inputPath = join(workDir, 'input.png');
  const inputBuf = await sharp({
    create: { width: 1920, height: 1080, channels: 3, background: '#3366cc' },
  })
    .png()
    .toBuffer();
  await writeFile(inputPath, inputBuf);
  console.log(`✓ 生成测试图: ${inputPath} (1920x1080 PNG)`);

  // 写 workflow JSON
  const wfPath = join(workDir, 'resize.json');
  await writeFile(wfPath, JSON.stringify(resizeWorkflow, null, 2), 'utf-8');

  // 调用 runWorkflow 真实跑 resize(默认注入 imageToolsPluginNode / sharp 引擎)
  const outputPath = join(workDir, 'output.png');
  console.log(`→ runWorkflow('${wfPath}', ['${inputPath}'], { output: '${outputPath}' })`);
  const result = await runWorkflow(wfPath, [inputPath], { output: outputPath });

  if (result.status !== 'completed') {
    console.error(`✗ 工作流执行失败: status=${result.status}, error=${result.error ?? '(no error)'}`);
    process.exitCode = 1;
    return;
  }
  console.log(`✓ 工作流执行完成: status=${result.status}, duration=${result.duration}ms, outputs=${result.outputs.length}`);

  // 验证输出文件
  if (!existsSync(outputPath)) {
    console.error(`✗ 输出文件未生成: ${outputPath}`);
    process.exitCode = 1;
    return;
  }
  const outBuf = await readFile(outputPath);
  const meta = await sharp(outBuf).metadata();
  console.log(`✓ 输出文件: ${outputPath} (${meta.width}x${meta.height} ${meta.format}, ${outBuf.length} bytes)`);
  console.log(`  resize 行为验证:1920x1080 → ${meta.width}x${meta.height}(fit=cover,目标 1280x720)`);
  console.log();

  console.log('=== 3. CI 场景提示 ===');
  console.log('在 GitHub Actions / GitLab CI 中,把上述 runWorkflow 调用嵌入');
  console.log('脚本即可实现:素材上传 → 自动 resize → 输出制品归档。');
  console.log('参考 .github/workflows/resize-ci.yml 查看 GitHub Actions 示例。');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
