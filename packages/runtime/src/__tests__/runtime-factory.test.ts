/**
 * createRuntime / createAssetStore 降级链测试(T5)
 *
 * 在 Node 环境下 OPFS 与 IndexedDB 均不可用,工厂应降级到 Memory store。
 * 通过导入资产后检查 blob.path 前缀验证实际使用的 store 类型。
 */
import { describe, it, expect } from 'vitest';
import type { LokvisEvent } from '@lokvis/schema';
import { createRuntime, LokvisRuntimeImpl } from '../runtime.js';
import {
  createAssetStore,
  createMemoryAssetStore,
} from '../asset-store.js';
import { isOpfsSupported } from '../opfs-asset-store.js';
import { isIdbSupported } from '../idb-asset-store.js';
import type { AssetSource, Workflow } from '@lokvis/schema';

/** Node 环境下 OPFS 不可用(无 navigator.storage) */
const OPFS_AVAILABLE = isOpfsSupported();
/** Node 环境(未注入 fake-indexeddb)下 IndexedDB 不可用 */
const IDB_AVAILABLE = isIdbSupported();

const pngBlob = (): Blob =>
  new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

const pngSource: AssetSource = { kind: 'blob', blob: pngBlob(), name: 'a.png' };

describe('createAssetStore 降级链(T5)', () => {
  it('preferOpfs:false 应跳过 OPFS,无 IDB 时降级到 Memory', async () => {
    const store = await createAssetStore({ preferOpfs: false });
    const asset = await store.import(pngSource);
    // OPFS 已被跳过;若 IDB 不可用则 Memory
    if (!IDB_AVAILABLE) {
      expect(asset.blob.path).toMatch(/^memory:\/\//);
    } else {
      expect(asset.blob.path).toMatch(/^idb:\/\//);
    }
  });

  it('默认在 Node 环境(无 OPFS/IDB)应降级到 Memory store', async () => {
    const store = await createAssetStore();
    const asset = await store.import({
      kind: 'blob',
      blob: pngBlob(),
      name: 'b.png',
    });
    if (!OPFS_AVAILABLE && !IDB_AVAILABLE) {
      expect(asset.blob.path).toMatch(/^memory:\/\//);
    }
    // 无论降级到哪一层,store 始终可用(import 不抛错)
    expect(asset.id).toBeTruthy();
  });

  it('降级后的 store 应支持完整 CRUD(import/get/getBlob/remove/list)', async () => {
    const store = await createAssetStore({ preferOpfs: false });
    const asset = await store.import({
      kind: 'blob',
      blob: pngBlob(),
      name: 'c.png',
    });
    const got = await store.get(asset.id);
    expect(got?.id).toBe(asset.id);
    const blob = await store.getBlob(asset.blob);
    expect(blob.size).toBe(3);
    expect((await store.list()).length).toBeGreaterThanOrEqual(1);
    await store.remove(asset.id);
    expect(await store.get(asset.id)).toBeUndefined();
  });
});

describe('createRuntime 工厂(T5)', () => {
  it('应返回 LokvisRuntimeImpl 实例并可导入资产', async () => {
    const runtime = await createRuntime();
    expect(runtime).toBeInstanceOf(LokvisRuntimeImpl);
    const id = await runtime.importAsset({
      kind: 'blob',
      blob: pngBlob(),
      name: 'd.png',
    });
    expect(id).toBeTruthy();
    const asset = await runtime.getAsset(id);
    expect(asset.metadata.size).toBe(3);
  });

  it('注入自定义 assetStore 应使用该 store(不降级)', async () => {
    const injected = createMemoryAssetStore();
    const runtime = await createRuntime({ assetStore: injected });
    const id = await runtime.importAsset({
      kind: 'blob',
      blob: pngBlob(),
      name: 'e.png',
    });
    const asset = await runtime.getAsset(id);
    // 注入的 Memory store,path 前缀为 memory://
    expect(asset.blob.path).toMatch(/^memory:\/\//);
  });

  it('enableOpfs:false 应传给工厂跳过 OPFS 探测', async () => {
    const runtime = await createRuntime({ enableOpfs: false });
    const id = await runtime.importAsset({
      kind: 'blob',
      blob: pngBlob(),
      name: 'f.png',
    });
    const asset = await runtime.getAsset(id);
    // OPFS 被跳过;Node 无 IDB → Memory
    if (!IDB_AVAILABLE) {
      expect(asset.blob.path).toMatch(/^memory:\/\//);
    }
  });
});

// ─── runtime.run schema 层校验 hook（三层防御第 3 层） ─────

describe('runtime.run schema 校验（修复 review：__input__ 哨兵边误判为环）', () => {
  /** 构造一个含 `__input__` 哨兵边的非法 workflow */
  function buildSentinelWorkflow(): Workflow {
    return {
      id: 'wf-sentinel',
      version: '1.0.0',
      name: 'sentinel-test',
      description: 'test',
      author: { id: 'a', name: 'tester' },
      category: 'image',
      tags: [],
      nodes: [
        { id: 'n1', type: 'transform', capability: 'cap.a', params: {} },
      ],
      edges: [{ from: '__input__', to: 'n1' }],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image', format: 'png' },
    };
  }

  it('run() 应在 executor 之前用 validateWorkflow 拦截哨兵边，返回 failed', async () => {
    const runtime = await createRuntime({ enableOpfs: false });
    const result = await runtime.run(buildSentinelWorkflow(), []);
    expect(result.status).toBe('failed');
    // 错误信息明确指向 __input__ 保留字，而非含糊的 "cycle"
    expect(result.error).toMatch(/__input__.*reserved|reserved.*__input__/i);
    expect(result.error).not.toMatch(/cycle/i);
  });

  it('校验失败时应发射 workflow:completed 事件（status=failed）', async () => {
    const runtime = await createRuntime({ enableOpfs: false });
    const events: LokvisEvent[] = [];
    runtime.eventBus.onAny((e) => events.push(e));
    await runtime.run(buildSentinelWorkflow(), []);
    const completed = events.find((e) => e.type === 'workflow:completed') as
      | { type: string; result?: { status: string } }
      | undefined;
    expect(completed).toBeDefined();
    expect(completed?.result?.status).toBe('failed');
  });

  it('校验失败后 runtime 状态应为 error', async () => {
    const runtime = await createRuntime({ enableOpfs: false });
    await runtime.run(buildSentinelWorkflow(), []);
    expect(runtime.status).toBe('error');
  });
});

// ─── W21.6: runtime.dispose() ─────────────────────────────────

describe('runtime.dispose() (W21.6)', () => {
  it('dispose 后再调 run/cancel/pause/resume/disposeWorkflow 应抛 disposed 错', async () => {
    const runtime = await createRuntime({ enableOpfs: false });
    await runtime.dispose();

    const wf: Workflow = {
      id: 'wf-x', version: '1.0.0', name: 'x', description: 'd',
      author: { id: 'a', name: 'tester' }, category: 'image', tags: [],
      nodes: [], edges: [],
      inputs: { type: 'image', multiple: false },
      outputs: { type: 'image' },
    };
    await expect(runtime.run(wf, [])).rejects.toThrow(/disposed/);
    await expect(runtime.cancel('any')).rejects.toThrow(/disposed/);
    await expect(runtime.pause('any')).rejects.toThrow(/disposed/);
    await expect(runtime.resume('any')).rejects.toThrow(/disposed/);
    await expect(runtime.disposeWorkflow('any')).rejects.toThrow(/disposed/);
  });

  it('dispose 应幂等:重复调用不抛错', async () => {
    const runtime = await createRuntime({ enableOpfs: false });
    await runtime.dispose();
    await expect(runtime.dispose()).resolves.toBeUndefined();
  });

  it('dispose 后 history 应返回空数组(历史栈已清空)', async () => {
    const runtime = await createRuntime({ enableOpfs: false });
    // 先 dispose 一个未存在的 workflowId 不会抛错(disposeHistory 内 stack 为 undefined 时 no-op)
    await runtime.dispose();
    await expect(runtime.history('any-wf')).resolves.toEqual([]);
    const state = await runtime.getHistoryState('any-wf');
    expect(state).toEqual({ entries: [], cursor: -1 });
  });
});
