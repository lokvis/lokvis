/**
 * Benchmark 报告生成器(D3)—— 把 results/raw.json 聚合为
 * lokvis-knowledge benchmark schema 格式,并用该 schema 做 ajv 自检。
 *
 * - runner 元数据自动注入:engine/engineVersion 来自 raw(engine-image
 *   package.json),environment 来自浏览器 + playwright 版本,
 *   hardwareClass 取 BENCH_HARDWARE_CLASS(CI 注入,默认 local-dev)
 * - 跳过的组合(skip)不进入 results —— knowledge 只登记事实数据
 * - 产物:results/image-ops-<YYYY-MM>.json,可直接拷入 knowledge
 *   仓 data/benchmarks/
 *
 * schema 位置:--schema <path> 或 KNOWLEDGE_DIR(默认同级 ../lokvis-knowledge)。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const here = dirname(fileURLToPath(import.meta.url));

const SUITE = 'image-ops';
const CORPUS_SOURCE_REF = 'ref:lokvis-corpus-v1';

function resolveSchemaPath() {
  const argIdx = process.argv.indexOf('--schema');
  if (argIdx >= 0) return resolve(process.argv[argIdx + 1]);
  const knowledgeDir = process.env.KNOWLEDGE_DIR ?? join(here, '../../lokvis-knowledge');
  return join(knowledgeDir, 'schemas/benchmark.schema.json');
}

const raw = JSON.parse(readFileSync(join(here, 'results/raw.json'), 'utf8'));

const generated = new Date(raw.generatedAt);
const yearMonth = `${generated.getUTCFullYear()}-${String(generated.getUTCMonth() + 1).padStart(2, '0')}`;

const results = raw.results
  .filter((r) => !r.skipped && r.aggregate)
  .map((r) => {
    const metrics = {
      encodeMsMedian: r.aggregate.encodeMsMedian,
      bytesRatioMedian: r.aggregate.bytesRatioMedian,
      imageCount: r.aggregate.imageCount,
    };
    if (r.aggregate.ssimMean != null) metrics.ssimMean = r.aggregate.ssimMean;
    return {
      operation: r.operation,
      from: `format:${r.from}`,
      to: `format:${r.to}`,
      quality: r.quality,
      params: { encoder: r.encoder, runsPerImage: r.runs },
      metrics,
    };
  });

if (results.length === 0) {
  console.error('No non-skipped results in raw.json - nothing to report.');
  process.exit(1);
}

const record = {
  id: `benchmark:${SUITE}-${yearMonth}`,
  version: '1.0.0',
  suite: SUITE,
  runner: {
    engine: raw.engine,
    engineVersion: raw.engineVersion,
    environment: `${raw.browser} (playwright ${raw.playwrightVersion})`,
    hardwareClass: process.env.BENCH_HARDWARE_CLASS ?? 'local-dev',
  },
  corpus: {
    name: raw.corpus.name,
    imageCount: raw.corpus.imageCount,
    sourceRef: CORPUS_SOURCE_REF,
  },
  results,
  generatedAt: raw.generatedAt,
  sources: [CORPUS_SOURCE_REF],
  reviewedAt: raw.generatedAt.slice(0, 10),
};

// ── ajv 自检(用 knowledge 仓的 benchmark schema) ─────────────────
const schemaPath = resolveSchemaPath();
if (!existsSync(schemaPath)) {
  console.error(`Schema not found: ${schemaPath} (pass --schema or set KNOWLEDGE_DIR)`);
  process.exit(1);
}
const ajv = new Ajv2020.default({ allErrors: true });
addFormats.default(ajv);
const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));
if (!validate(record)) {
  console.error('Schema self-check FAILED:');
  for (const e of validate.errors) console.error(`  ${e.instancePath || '/'} ${e.message}`);
  process.exit(1);
}

const outPath = join(here, `results/${SUITE}-${yearMonth}.json`);
writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
console.log(`Schema self-check passed. Report written to ${outPath}`);
console.log(`  id=${record.id} results=${results.length} corpus=${record.corpus.imageCount} images`);
