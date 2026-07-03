---
'@lokvis/ui-core': minor
---

新增 6 个基础组件 + 设计 Token 体系(W4.4 + W4.5)

- 新组件:Slider / Toggle / Select / Tabs / Dialog / Tooltip
- `styles/tokens.css`:`--lokvis-*` CSS 变量语义层(表面/前景/边框/主色/语义色/圆角/阴影/动效/字体)
- 暗色模式:`.dark` 类 + `@media (prefers-color-scheme: dark)` 双触发
- Tailwind v4 `@theme` 映射说明(消费方可在 CSS 中把变量映射为 Tailwind 颜色)
- 构建产物 `dist/styles.css`(package.json 已导出 `./styles.css`)
- 25 个组件单测(@testing-library/react + jsdom,覆盖受控/非受控/键盘/无障碍)
