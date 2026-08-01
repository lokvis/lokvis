# @lokvis/plugin-archive

## 0.10.0

### Minor Changes

- db5a442: 新增 archive.* 能力域(G1):engine-archive(fflate 纯 JS 零 WASM 同构)提供 zip / unzip / list
  Blob↔Blob 纯函数,plugin-archive 将其封装为 archive.zip(N→1)/ archive.unzip(1→N)/
  archive.list(1→1 输出 application/json data Asset)三个真实能力实现。旧 asset.archive
  声明已弃用并迁移至 archive.* 域。详见 docs/adr/ADR-017-archive-domain.md。

### Patch Changes

- Updated dependencies [db5a442]
- Updated dependencies
  - @lokvis/engine-archive@0.10.0
  - @lokvis/capability@0.10.0
  - @lokvis/schema@0.10.0
  - @lokvis/plugin-sdk@0.10.0
