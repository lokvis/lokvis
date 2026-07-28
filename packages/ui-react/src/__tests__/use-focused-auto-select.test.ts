// @vitest-environment jsdom
/**
 * useFocusedAutoSelect + importFiles.lastImportedIds 单元测试
 *
 * focused 模式(单工具页)不渲染 AssetPanel,新导入资产无人选中、
 * 缩略图无人触发。本测试验证:
 * - importFiles 返回导入 ID 列表并在 refreshAssets 后写入 lastImportedIds
 * - focused 模式下 hook 自动选中最新导入资产并触发 ensureThumbnails
 * - full 模式下 hook 不干预选择(AssetPanel 负责)
 * - 工作流输出进入 assets 不会被误判为导入(语义由 lastImportedIds 隔离)
 *
 * 使用真实 useWorkspaceStore + 最小 runtime mock(仅覆盖本链路用到的方法)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import type { Asset, AssetSource, AssetType } from '@lokvis/schema';
import type { LokvisRuntime } from '@lokvis/runtime';
import { useFocusedAutoSelect } from '../hooks/useFocusedAutoSelect.js';
import { useWorkspaceStore } from '../store/index.js';

/** 本链路用到的 runtime 方法子集(importFiles / ensureThumbnails / refreshStorageUsage) */
type MockRuntime = Pick<
  LokvisRuntime,
  'importAsset' | 'listAssets' | 'exportAsset' | 'getStorageUsage'
>;

let idCounter = 0;
let urlCounter = 0;

function makeAsset(id: string, type: AssetType): Asset {
  const mimeType = type === 'image' ? 'image/png' : 'video/mp4';
  return {
    id,
    type,
    metadata: { mimeType, size: 100, format: type === 'image' ? 'png' : 'mp4' },
    blob: { path: `/assets/${id}`, size: 100, mimeType },
    history: [],
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeMockRuntime(): MockRuntime {
  const stored: Asset[] = [];
  return {
    importAsset: vi.fn(async (source: AssetSource) => {
      const id = `asset-${++idCounter}`;
      const mime = source.kind === 'file' ? source.file.type : 'application/octet-stream';
      stored.push(makeAsset(id, mime.startsWith('image/') ? 'image' : 'video'));
      return id;
    }),
    listAssets: vi.fn(async () => [...stored]),
    exportAsset: vi.fn(async () => new Blob(['fake-image-bytes'], { type: 'image/png' })),
    getStorageUsage: vi.fn(async () => ({ usage: 100, quota: 1024 })),
  };
}

function makeFile(name: string, type: string): File {
  return new File(['data'], name, { type });
}

beforeEach(() => {
  idCounter = 0;
  urlCounter = 0;
  // jsdom 未实现 ObjectURL API,按文件级 stub(ensureThumbnails 依赖)
  URL.createObjectURL = vi.fn(() => `blob:mock-${++urlCounter}`);
  URL.revokeObjectURL = vi.fn();
  // store 是模块级单例,每个测试前重置本链路涉及的状态
  useWorkspaceStore.setState({
    runtime: null,
    assets: [],
    selectedAssetId: null,
    thumbnails: {},
    lastImportedIds: [],
    statusMessage: { key: 'status.idle' },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('importFiles 导入 ID 契约', () => {
  it('应返回导入的 AssetId 列表并写入 lastImportedIds', async () => {
    const runtime = makeMockRuntime();
    useWorkspaceStore.setState({ runtime: runtime as LokvisRuntime });

    let ids: string[] = [];
    await act(async () => {
      ids = await useWorkspaceStore
        .getState()
        .importFiles([makeFile('a.png', 'image/png'), makeFile('b.png', 'image/png')]);
    });

    expect(ids).toEqual(['asset-1', 'asset-2']);
    const state = useWorkspaceStore.getState();
    expect(state.lastImportedIds).toEqual(['asset-1', 'asset-2']);
    expect(state.assets.map((a) => a.id)).toEqual(['asset-1', 'asset-2']);
    expect(state.statusMessage).toEqual({ key: 'status.imported', params: { count: 2 } });
  });

  it('runtime 未就绪时应返回空数组', async () => {
    const ids = await useWorkspaceStore.getState().importFiles([makeFile('a.png', 'image/png')]);
    expect(ids).toEqual([]);
    expect(useWorkspaceStore.getState().lastImportedIds).toEqual([]);
  });
});

describe('useFocusedAutoSelect', () => {
  it('focused 模式下导入完成后应自动选中最新资产并生成缩略图', async () => {
    const runtime = makeMockRuntime();
    useWorkspaceStore.setState({ runtime: runtime as LokvisRuntime });
    renderHook(() => useFocusedAutoSelect(true));

    await act(async () => {
      await useWorkspaceStore.getState().importFiles([makeFile('a.png', 'image/png')]);
    });

    expect(useWorkspaceStore.getState().selectedAssetId).toBe('asset-1');
    // 缩略图由 ensureThumbnails 异步生成(fire-and-forget),等待其落库
    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().thumbnails['asset-1']).toBe('blob:mock-1');
    });
  });

  it('多文件导入应选中批次中最后一个资产', async () => {
    const runtime = makeMockRuntime();
    useWorkspaceStore.setState({ runtime: runtime as LokvisRuntime });
    renderHook(() => useFocusedAutoSelect(true));

    await act(async () => {
      await useWorkspaceStore.getState().importFiles([
        makeFile('a.png', 'image/png'),
        makeFile('b.png', 'image/png'),
        makeFile('c.png', 'image/png'),
      ]);
    });

    expect(useWorkspaceStore.getState().selectedAssetId).toBe('asset-3');
  });

  it('重复导入应选中新一批次的最新资产', async () => {
    const runtime = makeMockRuntime();
    useWorkspaceStore.setState({ runtime: runtime as LokvisRuntime });
    renderHook(() => useFocusedAutoSelect(true));

    await act(async () => {
      await useWorkspaceStore.getState().importFiles([makeFile('a.png', 'image/png')]);
    });
    expect(useWorkspaceStore.getState().selectedAssetId).toBe('asset-1');
    // 等待第一批次缩略图落库,保证后续 createObjectURL 调用顺序确定
    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().thumbnails['asset-1']).toBe('blob:mock-1');
    });

    await act(async () => {
      await useWorkspaceStore.getState().importFiles([
        makeFile('b.png', 'image/png'),
        makeFile('c.png', 'image/png'),
      ]);
    });
    expect(useWorkspaceStore.getState().selectedAssetId).toBe('asset-3');
    await vi.waitFor(() => {
      expect(useWorkspaceStore.getState().thumbnails['asset-3']).toBe('blob:mock-3');
    });
  });

  it('full 模式下导入后不应自动选中(由用户通过 AssetPanel 手动选择)', async () => {
    const runtime = makeMockRuntime();
    useWorkspaceStore.setState({ runtime: runtime as LokvisRuntime });
    renderHook(() => useFocusedAutoSelect(false));

    await act(async () => {
      await useWorkspaceStore.getState().importFiles([makeFile('a.png', 'image/png')]);
    });

    expect(useWorkspaceStore.getState().selectedAssetId).toBeNull();
    expect(useWorkspaceStore.getState().thumbnails).toEqual({});
  });

  it('非 image 资产应被选中但不生成缩略图', async () => {
    const runtime = makeMockRuntime();
    useWorkspaceStore.setState({ runtime: runtime as LokvisRuntime });
    renderHook(() => useFocusedAutoSelect(true));

    await act(async () => {
      await useWorkspaceStore.getState().importFiles([makeFile('clip.mp4', 'video/mp4')]);
    });

    expect(useWorkspaceStore.getState().selectedAssetId).toBe('asset-1');
    // ensureThumbnails 对非 image 资产同步跳过,不会发起 export
    expect(runtime.exportAsset).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().thumbnails).toEqual({});
  });

  it('工作流输出进入 assets 不应触发自动选中(仅 importFiles 写入 lastImportedIds)', async () => {
    const runtime = makeMockRuntime();
    useWorkspaceStore.setState({ runtime: runtime as LokvisRuntime });
    renderHook(() => useFocusedAutoSelect(true));

    // 模拟工作流输出:run() 结尾 refreshAssets 会把输出资产带入 store.assets,
    // 但不经过 importFiles → lastImportedIds 不变 → hook 不应响应
    const output = makeAsset('output-1', 'image');
    useWorkspaceStore.setState({ assets: [output] });

    expect(useWorkspaceStore.getState().selectedAssetId).toBeNull();
    expect(runtime.exportAsset).not.toHaveBeenCalled();
  });
});
