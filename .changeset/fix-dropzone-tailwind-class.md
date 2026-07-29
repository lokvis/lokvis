---
'@lokvis/ui-react': patch
---

修复 GlobalDropzone 遮罩非法 Tailwind 类

- 拖拽遮罩此前使用 `bg-[var(--lokvis-primary)]/10/80`(双重不透明度修饰符,非法且对 `var()` 颜色无效),改用现成的 `--lokvis-primary-soft` 半透明主色 token(第三方可定制)
