/**
 * Compat check —— FormatSupportProbe(encode) ↔ data-compatibility(encode 列)双向守卫。
 *
 * 复用 D2 benchmark 的「vite dev server + Playwright chromium + harness」模式:
 * 在真实 chromium 内跑 @lokvis/browser-adapter 的 detectEncodeSupport,与
 * lokvis-knowledge @lokvis/data-compatibility 的 compat:image-browsers 记录 chrome
 * encode 列逐格式断言。语义一致(both = 编码/encode 能力),任一格式对不上即 fail。
 *
 * 覆盖范围:运行时探测的 5 个格式 × chrome 环境(与知识仓 encode 维度范围一致)。
 * 人为改错任一侧数据即 exit 1(负向守卫)。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

/** 运行时探测覆盖、且知识仓填了 encode 列的格式 */
const PROBE_FORMATS = ['png', 'jpeg', 'webp', 'avif', 'gif'];
const ENV = 'chrome';
const RECORD_ID = 'compat:image-browsers';

/** 读取 @lokvis/data-compatibility bundle(default 条件 = dist/compatibility.json) */
function loadCompatBundle() {
  const jsonPath = require.resolve('@lokvis/data-compatibility');
  return JSON.parse(readFileSync(jsonPath, 'utf8'));
}

function knowledgeEncodeSupported(bundle) {
  const record = bundle.records.find((r) => r.id === RECORD_ID);
  if (!record) throw new Error(`record ${RECORD_ID} not found in data-compatibility bundle`);
  const expected = {};
  const problems = [];
  for (const fmt of PROBE_FORMATS) {
    const entry = record.entries.find((e) => e.subject === `format:${fmt}`);
    if (!entry) {
      problems.push(`format:${fmt} 在 ${RECORD_ID} 中缺失`);
      continue;
    }
    const cell = entry.support?.[ENV];
    const encode = cell?.encode;
    if (!encode) {
      problems.push(`format:${fmt} 的 ${ENV} 缺少 encode 字段(守卫要求填写)`);
      continue;
    }
    if (encode.status === 'supported') {
      expected[fmt] = true;
    } else if (encode.status === 'unsupported') {
      expected[fmt] = false;
    } else {
      problems.push(`format:${fmt} 的 ${ENV}.encode.status=${encode.status}(仅接受 supported/unsupported)`);
    }
  }
  return { expected, problems, recordVersion: record.version };
}

async function probeInBrowser() {
  const server = await createServer({
    configFile: false,
    root: here,
    logLevel: 'warn',
    server: { port: 0, fs: { allow: [repoRoot] } },
  });
  await server.listen();
  const port = server.httpServer.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('[page]', e.message));
    await page.goto(`http://localhost:${port}/harness-compat/`);
    await page.waitForFunction(() => typeof window.__compat === 'object', undefined, {
      timeout: 30_000,
    });
    const probed = await page.evaluate(
      (formats) => window.__compat.probe(formats),
      PROBE_FORMATS
    );
    return { probed, browserVersion: browser.version() };
  } finally {
    await browser.close();
    await server.close();
  }
}

async function main() {
  const bundle = loadCompatBundle();
  const { expected, problems, recordVersion } = knowledgeEncodeSupported(bundle);
  const { probed, browserVersion } = await probeInBrowser();

  console.log(`data-compatibility ${RECORD_ID} v${recordVersion} × chromium-${browserVersion}`);
  console.log(`探测(encode)vs 知识仓 ${ENV}.encode 列:`);

  const mismatches = [...problems];
  for (const fmt of PROBE_FORMATS) {
    const actual = probed[fmt];
    const want = expected[fmt];
    const ok = want !== undefined && actual === want;
    console.log(
      `  ${ok ? 'OK  ' : 'FAIL'} ${fmt.padEnd(5)} probe=${String(actual).padEnd(5)} knowledge=${want === undefined ? 'n/a' : want}`
    );
    if (want === undefined) continue; // 已在 problems 记录
    if (actual !== want) {
      mismatches.push(`format:${fmt}: probe=${actual} 但知识仓 ${ENV}.encode=${want}`);
    }
  }

  if (mismatches.length) {
    console.error('\n一致性守卫失败:');
    for (const m of mismatches) console.error(`  - ${m}`);
    process.exit(1);
  }
  console.log('\n一致性守卫通过:5 格式 encode 探测与知识仓 chrome encode 列逐一吻合。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
