# ADR-017: 新建 archive.* 能力域（engine-archive + plugin-archive，弃用 asset.archive）

- 状态:Accepted
- 日期:2026-07-31
- 关联:ADR-013(Capability Manifest)、ADR-016(Engine 契约裁决)、`docs/architecture-v2-tasks.md` G1

## 背景

旧 `asset.archive`（`packages/capability/src/presets/asset.ts` 手写项)声明了"打包为
zip"的能力,但**从未有 engine / plugin 实现**——它只是一条悬空声明,`CapabilityRegistry`
无对应 implementation,调用即失败。G1 要求补齐真实的 zip/unzip/list 能力面。

两个设计岔口需裁决:
1. 沿用横切 `asset.archive` 单能力,还是新建独立 `archive.*` 域?
2. 用什么库实现(浏览器/Node 同构、体积、WASM 依赖)?

## 决策

1. **新建独立 `archive.*` 域,弃用 `asset.archive`**:
   - 归档是一组能力(zip / unzip / list),而非单一操作;独立域更清晰,
     与 image/pdf/audio 等媒体域对齐,codegen 从 `manifests/archive.manifest.json`
     统一生成声明与 `BuiltinCapabilityName` 联合类型。
   - `asset.*` 仅保留真正跨类型且无引擎的通用操作(`asset.rename`)。
   - 旧 `asset.archive` 从 `ASSET_CAPABILITIES` 移除;迁移映射:
     `asset.archive` → `archive.zip`。

2. **选型 fflate**:
   - 纯 JS,**零 WASM**,浏览器/Node 同构(`zipSync`/`unzipSync` 同步 API 两端一致),
     无需 `./node` 子路径,单一实现即可两端运行。
   - 体积小(~30KB min),无原生依赖,契合"engine 只暴露 Blob↔Blob 纯函数"。
   - 备选 JSZip 体积更大且异步 API 分叉;archiver/adm-zip 仅 Node。均劣于 fflate。

3. **能力形态**:
   - `archive.zip` — N→1 merge(`createMergeCapabilityImpl`),输出 `application/zip` data Asset;
     参数 `names`(各条目文件名,缺省 `file-{index}`)、`level`(0-9,默认 6)。
   - `archive.unzip` — 1→N split(`createSplitCapabilityImpl`),每个条目一个 data Asset。
   - `archive.list` — 1→1(`createBlobCapabilityImpl`),输出 `application/json` data Asset
     `{ count, entries: { name, size }[] }`。

4. **真实现而非 stub**:`ARCHIVE_ENGINE.version` 不含 `'stub'`,故 `isStub=false`,
   三个实现 `status='stable'`,`CapabilityRegistry.resolve()` 正常选用(与
   engine-audio/pdf 浏览器 stub 相反)。

5. **大文件内存守卫**:Engine 层(L1)不能 import Runtime 的 `MemoryGuard`(L4)。
   内存守卫仍由 Runtime 批处理层负责;fflate 提供流式 API,未来大文件可切流式,
   本次先用同步 API(足够覆盖常见资产打包场景)。

## 影响

- 新增包:`@lokvis/engine-archive`、`@lokvis/plugin-archive`(均纳入 changeset fixed 组)。
- `manifests/archive.manifest.json` → codegen 产出 `archive.generated.ts` +
  `capability-names.generated.ts` 新增 `archive.zip/unzip/list`。
- `presets/index.ts`、`presets/builtin.ts` 接线 `ARCHIVE_CAPABILITIES`;
  `presets/asset.ts` 移除 `ASSET_ARCHIVE`。
- 文档:`docs/capabilities.md` 新增 Archive 段并移除 asset.archive 行。

## 备选与放弃理由

- **保留 asset.archive 并实现**:横切域承载多能力语义不清,且 zip/unzip/list
  天然成组,放弃。
- **JSZip**:体积大、API 异步分叉,放弃。
- **独立 `@lokvis/fs` 承载 archive**:archive 与文件系统访问(G3 FilePicker)职责不同,
  不混包。
