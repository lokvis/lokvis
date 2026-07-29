---
'@lokvis/ui-core': patch
'@lokvis/ui-react': patch
---

Workspace 卡片式现代化改版(保持 `--lokvis-*` 变量自定义能力)

**@lokvis/ui-core**

- Token:`--lokvis-bg` 改为 `#fafafa`(与 surface 拉开层次);新增 `--lokvis-primary-soft`(选中态底色)与 `--lokvis-font-sans`(系统字体栈),`@theme` 同步注册 `--color-lokvis-primary-soft` / `--font-lokvis-sans`
- 新增入场动效工具类 `.lokvis-animate-fade-in` / `.lokvis-animate-pop-in`(prefers-reduced-motion 自动禁用),Dialog 遮罩/面板应用
- Button primary 变体由黑白反色改为品牌色(`--lokvis-primary` + hover),统一 `duration-150 ease-out` 与 `active:scale-[0.98]` 按压反馈

**@lokvis/ui-react**

- Workspace 中部三栏改为卡片式布局:面板浮于 `--lokvis-bg` 之上,圆角 + 边框 + `elevation-1` 阴影,`gap-2 p-2` 间距;移动端抽屉加 surface 底色与 overlay 阴影
- Toolbar 去下边框改用 `elevation-1` 阴影;AssetPanel / Inspector 移除侧边框(卡片自带边框)
- 选中态统一为 `--lokvis-primary-soft`;hover 统一为 `surface-muted`(卡片化后 surface hover 不可见)
- 字号底线:`text-[9px]` / `text-[10px]` 全部提升到 `text-[11px]`
