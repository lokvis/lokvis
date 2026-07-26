---
"@lokvis/ui-react": patch
---

feat(ui-react): focused 模式自动选中新导入资产并生成缩略图

- 新增 store 状态 lastImportedIds:importFiles 收集 runtime.importAsset 返回的 AssetId,在 refreshAssets 完成后写入(保证 ID 已在 store.assets 中)
- importFiles 返回类型由 Promise<void> 改为 Promise<string[]>,返回本批次导入的 AssetId 列表(调用方忽略返回值时向后兼容)
- 新增 useFocusedAutoSelect hook:focused 模式(无 AssetPanel)下监听 lastImportedIds,自动选中批次最新资产并触发 ensureThumbnails;full 模式不执行任何逻辑
- 不用 assets 差分检测新资产:工作流输出经 run() 结尾的 refreshAssets 同样进入 store.assets,差分法会把输出误判为新导入并抢占选中状态,破坏 before/after 对比
