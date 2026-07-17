/**
 * Assets slice —— 资产导入 / 选择 / 删除 / 缩略图
 *
 * TD-5.1 长期方案:缩略图 ObjectURL 的创建 / 替换 / 释放统一在 store 内管理,
 * 消除原先"创建在 AssetPanel effect、释放在 removeAsset action"的跨边界脆弱性。
 * - ensureThumbnails:iterate assets → exportAsset → createObjectURL → setThumbnail
 * - setThumbnail:替换时自动 revoke 旧 ObjectURL
 * - removeAsset:删除时 revoke ObjectURL + 清理 entry
 * inflight 去重通过闭包捕获的 Set(非响应式,不触发额外 re-render)。
 */
import type { StateCreator } from 'zustand';
import type { WorkspaceStore, WorkspaceState, WorkspaceActions } from './types.js';

export interface AssetsSlice
  extends Pick<WorkspaceState, 'assets' | 'selectedAssetId' | 'thumbnails'>,
    Pick<
      WorkspaceActions,
      | 'refreshAssets'
      | 'importFiles'
      | 'selectAsset'
      | 'setThumbnail'
      | 'ensureThumbnails'
      | 'removeAsset'
    > {}

export const createAssetsSlice: StateCreator<
  WorkspaceStore,
  [],
  [],
  AssetsSlice
> = (set, get) => {
  // TD-5.1:per-store inflight 缩略图去重(闭包捕获,非响应式,不触发 re-render)
  const inflightThumbnails = new Set<string>();

  return {
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
      await get().refreshStorageUsage();
      set({ statusMessage: `Imported ${files.length} file(s)` });
    },

    selectAsset(id) {
      set({ selectedAssetId: id });
    },

    setThumbnail(id, url) {
      // TD-5.1:替换时 revoke 旧 ObjectURL,集中管理释放,避免孤儿 URL
      set((state) => {
        const old = state.thumbnails[id];
        if (old) {
          try {
            URL.revokeObjectURL(old);
          } catch {
            /* URL 已失效或非 ObjectURL,忽略 */
          }
        }
        return { thumbnails: { ...state.thumbnails, [id]: url } };
      });
    },

    ensureThumbnails() {
      const { runtime, assets, thumbnails } = get();
      if (!runtime) return;
      for (const asset of assets) {
        if (thumbnails[asset.id]) continue;
        if (asset.type !== 'image') continue;
        if (inflightThumbnails.has(asset.id)) continue;
        inflightThumbnails.add(asset.id);
        void (async () => {
          try {
            const blob = await runtime.exportAsset(asset.id);
            const url = URL.createObjectURL(blob);
            // 资产可能在 await 期间被删除:若已不在 assets 中,revoke URL 不入 store
            if (!get().assets.some((a) => a.id === asset.id)) {
              URL.revokeObjectURL(url);
              return;
            }
            get().setThumbnail(asset.id, url);
          } catch {
            // export 失败,不留缩略图(下次 ensureThumbnails 会重试)
          } finally {
            inflightThumbnails.delete(asset.id);
          }
        })();
      }
    },

    async removeAsset(id) {
      const { runtime } = get();
      if (!runtime) return;
      await runtime.removeAsset(id);
      await get().refreshAssets();
      await get().refreshStorageUsage();
      if (get().selectedAssetId === id) set({ selectedAssetId: null });

      // TD-5.1:删除资产时 revoke 缩略图 ObjectURL + 清理 entry(与 setThumbnail
      // 的 replace-revoke 一起,构成"创建/替换/释放"全在 store 内的闭环)
      const oldUrl = get().thumbnails[id];
      if (oldUrl) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch {
          /* URL 已失效或非 ObjectURL,忽略 */
        }
        set((state) => {
          const next = { ...state.thumbnails };
          delete next[id];
          return { thumbnails: next };
        });
      }
    },
  };
};
