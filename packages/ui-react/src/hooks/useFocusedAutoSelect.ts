/**
 * useFocusedAutoSelect - focused 模式下自动选中新导入资产并生成缩略图
 *
 * focused 布局(单工具页,mode='focused')不渲染 AssetPanel,因此:
 * - AssetPanel 内的 ensureThumbnails effect 不存在 → 缩略图不会生成,
 *   Canvas 即使有选中资产也无预览;
 * - 没有手动选择资产的 UI → 导入后 Canvas 一直停留在空状态。
 *
 * 本 hook 在 focused 模式下接管这两项职责:监听 store.lastImportedIds
 * (importFiles 在 refreshAssets 完成后写入),自动选中本批次最新一个
 * 资产并触发 ensureThumbnails。
 *
 * 为什么不用"assets 差分检测新资产":工作流输出也会进入 store.assets
 * (run() 结尾 refreshAssets),差分法会把输出误判为新导入资产并抢占
 * 选中状态,破坏 before/after 对比。lastImportedIds 只由 importFiles
 * 写入,语义精确。
 *
 * full 模式下本 hook 不执行任何逻辑(AssetPanel 已覆盖缩略图生成,
 * 且用户可手动选择资产)。
 */
import { useEffect } from 'react';
import { useWorkspaceStore } from '../store/index.js';

export function useFocusedAutoSelect(isFocused: boolean): void {
  const lastImportedIds = useWorkspaceStore((s) => s.lastImportedIds);
  const selectAsset = useWorkspaceStore((s) => s.selectAsset);
  const ensureThumbnails = useWorkspaceStore((s) => s.ensureThumbnails);

  useEffect(() => {
    // full 模式:AssetPanel 负责缩略图,选择由用户手动完成
    if (!isFocused) return;
    // 初始空列表(尚未导入)或 runtime 未就绪时的空导入都不触发
    if (lastImportedIds.length === 0) return;
    // 选中本批次最新一个资产(importFiles 按导入顺序追加,末尾为最新)
    selectAsset(lastImportedIds[lastImportedIds.length - 1]!);
    // focused 模式无 AssetPanel,缩略图需在此触发;
    // store 内 inflight 去重保证与任何潜在并发调用不冲突
    ensureThumbnails();
  }, [isFocused, lastImportedIds, selectAsset, ensureThumbnails]);
}
