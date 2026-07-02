# @lokvis/schema

## 0.2.0-beta.0

### Minor Changes

- - `history:changed` 事件新增 `currentIndex: number` 字段,标识已应用游标位置
  - `CapabilityImplementation` 新增可选 `status?: 'stable' | 'stub'` 字段,用于区分真实实现与占位
