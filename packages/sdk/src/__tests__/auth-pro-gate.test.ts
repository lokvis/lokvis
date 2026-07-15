/**
 * SDK Pro 门控逻辑单测(W17.8)
 *
 * 覆盖:
 * - createLokvis({ auth }) 钩子据 session/token presence 推导 isPro
 * - auth.isPro 显式覆盖优先级
 * - 不传 auth 保持 free 模式
 * - 直接传 RuntimeConfig.isPro 仍生效(无 auth 时)
 * - Pro 模式下 BatchProcessor 不再受 FREE_BATCH_LIMIT 约束
 *
 * 不测 token 形态/签名校验 —— SDK 不做此校验(由 cloud 网关负责)。
 */
import { describe, it, expect } from 'vitest';
import { createLokvis, type LokvisAuthSession } from '../index.js';
import {
  BatchLimitExceededError,
  FREE_BATCH_LIMIT,
} from '@lokvis/runtime';
import type { Workflow } from '@lokvis/schema';

/** 构造最小合法 Workflow(仅供 BatchProcessor.enqueue 占位,不实际执行) */
function makeWorkflow(id = 'wf-test'): Workflow {
  return {
    id,
    version: '1.0.0',
    name: 'test-wf',
    description: 'test workflow',
    author: { id: 'tester', name: 'Tester' },
    category: 'image',
    tags: [],
    nodes: [{ id: 'n1', type: 'transform', capability: 'image.resize' }],
    edges: [],
    inputs: { type: 'image', multiple: false },
    outputs: { type: 'image' },
  };
}

/** 构造 n 个批量条目(仅 source,无需真实文件) */
function makeItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    source: { kind: 'file', file: new File([new Uint8Array([0])], `f${i}.png`, { type: 'image/png' }) },
    workflow: makeWorkflow(`wf-${i}`),
  }));
}

describe('createLokvis auth 钩子(W17.3) → isPro 推导(W17.8)', () => {
  it('不传 auth 时 runtime.isPro === false(free 模式)', async () => {
    const rt = await createLokvis();
    expect(rt.isPro).toBe(false);
  });

  it('auth.session 非空时 → isPro === true', async () => {
    const rt = await createLokvis({
      auth: { session: 'fake-jwt-from-cloud' },
    });
    expect(rt.isPro).toBe(true);
  });

  it('auth.token 非空时 → isPro === true', async () => {
    const rt = await createLokvis({
      auth: { token: 'api-token-from-cli' },
    });
    expect(rt.isPro).toBe(true);
  });

  it('auth 同时传空 session + 空 token → isPro === false(无凭证)', async () => {
    const rt = await createLokvis({
      auth: { session: '', token: '' },
    });
    expect(rt.isPro).toBe(false);
  });

  it('auth.isPro 显式 false 优先于 session presence', async () => {
    // cloud 已识别为游客 session:发了 session 但标记 isPro=false
    const rt = await createLokvis({
      auth: { session: 'guest-jwt', isPro: false } satisfies LokvisAuthSession,
    });
    expect(rt.isPro).toBe(false);
  });

  it('auth.isPro 显式 true 但无 session/token → isPro === true', async () => {
    // 测试 / dev 模式:无凭证但显式开启 Pro
    const rt = await createLokvis({
      auth: { isPro: true } satisfies LokvisAuthSession,
    });
    expect(rt.isPro).toBe(true);
  });

  it('未传 auth 但直接传 RuntimeConfig.isPro=true → isPro === true', async () => {
    // 兼容路径:不通过 auth,直接走 RuntimeConfig
    const rt = await createLokvis({ isPro: true });
    expect(rt.isPro).toBe(true);
  });

  it('auth.isPro=true 与 RuntimeConfig.isPro=false 同时存在 → auth 胜出(true)', async () => {
    // 边界:cloud 已确认 Pro 但本地误传 isPro=false,以 auth 为准
    const rt = await createLokvis({
      isPro: false,
      auth: { isPro: true },
    });
    expect(rt.isPro).toBe(true);
  });
});

describe('Pro 门控行为:BatchProcessor 受 isPro 约束', () => {
  it('free 模式:enqueue 超过 FREE_BATCH_LIMIT 应抛 BatchLimitExceededError', async () => {
    const rt = await createLokvis(); // isPro = false
    expect(() => rt.batch.enqueue({ items: makeItems(FREE_BATCH_LIMIT + 1) })).toThrow(
      BatchLimitExceededError
    );
  });

  it('Pro 模式:enqueue 超过 FREE_BATCH_LIMIT 不抛错(auth.session 触发)', async () => {
    const rt = await createLokvis({
      auth: { session: 'cloud-jwt' },
    });
    expect(rt.isPro).toBe(true);
    // Pro 模式下 11 项不应抛错(job 立即排队,异步执行后续可被 cancel)
    const job = rt.batch.enqueue({ items: makeItems(FREE_BATCH_LIMIT + 1) });
    expect(job.id).toMatch(/^batch_/);
    // 清理:cancel 避免后台 worker 真去跑空 workflow
    await rt.batch.cancel(job.id);
  });

  it('free 模式正好 10 项应通过(边界值)', async () => {
    const rt = await createLokvis();
    const job = rt.batch.enqueue({ items: makeItems(FREE_BATCH_LIMIT) });
    expect(job.id).toMatch(/^batch_/);
    await rt.batch.cancel(job.id);
  });
});
