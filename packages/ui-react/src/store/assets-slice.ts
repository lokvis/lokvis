/**
 * Assets slice —— 资产导入 / 选择 / 删除 / 缩略图
 */
import type { StateCreator } from 'zustand';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';

export interface AssetsSlice
  extends Pick<WorkspaceState, 'assets' | 'selectedAssetId' | 'thumbnails'>,
    Pick<
      WorkspaceActions,
      'refreshAssets' | 'importFiles' | 'selectAsset' | 'setThumbnail' | 'removeAsset'
    > {}

export const createAssetsSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  AssetsSlice
> = (set, get) => ({
  assets: [],
  selectedAssetId: null,
  thumbnails: {},

  async refreshAssets() {
    const { runtime } = get();
    if (!runtime) return;
    const assets = await runtime.listAssets();
    set({ assets });
  },

  async importFiles(files) {
    const { runtime } = get();
    if (!runtime) return;
    set({ statusMessage: `Importing ${files.length} file(s)...` });
    for (const file of files) {
      await runtime.importAsset({ kind: 'file', file });
    }
    await get().refreshAssets();
    set({ statusMessage: `Imported ${files.length} file(s)` });
  },

  selectAsset(id) {
    set({ selectedAssetId: id });
  },

  setThumbnail(id, url) {
    set((state) => ({ thumbnails: { ...state.thumbnails, [id]: url } }));
  },

  async removeAsset(id) {
    const { runtime } = get();
    if (!runtime) return;
    await runtime.removeAsset(id);
    await get().refreshAssets();
    if (get().selectedAssetId === id) set({ selectedAssetId: null });

    // 修复 review 报告：原实现删除 asset 后未 revoke 缩略图 ObjectURL，导致
    // 浏览器 Blob 引用泄漏（每删一张图就漏一个 blob 内存）。
    // 同时从 thumbnails map 中删除该 entry，避免 stale ref
    const oldUrl = get().thumbnails[id];
    if (oldUrl) {
      try {
        URL.revokeObjectURL(oldUrl);
      } catch {
        /* URL 已失效或非 ObjectURL，忽略 */
      }
      set((state) => {
        const next = { ...state.thumbnails };
        delete next[id];
        return { thumbnails: next };
      });
    }
  },
});
