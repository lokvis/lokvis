---
'@lokvis/ui-react': minor
---

W17.4 + W17.5: useCustomPresets hook — 自定义尺寸预设(免费 3 / Pro 无限)

## 新增

- `useCustomPresets(isPro)` hook:用户自定义图像尺寸预设的本地持久化
  - localStorage key: `lokvis.customPresets`
  - 免费上限 3 个 / Pro 无限(`FREE_PRESET_LIMIT = 3` / `PRO_PRESET_LIMIT = Infinity`)
  - JSON 容错:解析失败 / 非数组 / 字段缺失 / 非法 fit/format 值时返回空数组或过滤
  - 跨 tab storage 事件 + 同 tab 自定义事件同步
  - 自定义预设 id 以 `custom.` 前缀,与内置 PLATFORM_PRESETS 命名空间隔离
- 导出纯函数供测试:`readCustomPresetsFromStorage` / `writeCustomPresetsToStorage` / `genCustomPresetId`
- 21 单测覆盖:读写往返 / 容错 / 限制门控 / id 生成

## Pro 门控完整矩阵

| 门控 | Free | Pro | 实现位置 |
|------|------|-----|---------|
| Batch 文件数 | 10 | 无限 | `batch-processor.ts` ✅ |
| Batch 并发 | 4 | 16 | `concurrency-controller.ts` ✅ |
| Workflow 槽位 | 5 | 无限 | `useWorkflows.ts` ✅ |
| **自定义预设** | **3** | **无限** | **`useCustomPresets.ts` ✅ (本次)** |

## 迁移

消费者从 `@lokvis/ui-react` 导入:

```typescript
import { useCustomPresets } from '@lokvis/ui-react';

function MyComponent({ isPro }: { isPro: boolean }) {
  const { presets, save, remove, canSaveMore, remaining } = useCustomPresets(isPro);
  // save({ name: '我的方形', width: 1080, height: 1080, fit: 'cover' })
}
```
