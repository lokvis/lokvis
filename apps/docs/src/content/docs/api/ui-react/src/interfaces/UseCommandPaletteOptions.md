---
editUrl: false
next: false
prev: false
title: "UseCommandPaletteOptions"
---

Defined in: [ui-react/src/components/CommandPalette.tsx:275](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/CommandPalette.tsx#L275)

useCommandPalette - 在组件中注册 ⌘K / Ctrl+K 全局快捷键打开面板。

返回 [open, setOpen]。在 useEffect 中绑定 keydown 监听。
兼容 macOS(⌘K)与 Windows/Linux(Ctrl+K)。Shift+⌘K / Ctrl+Shift+K 也触发,
方便用户在 ⌘K 被浏览器拦截时使用。

## Example

```tsx
const [open, setOpen] = useCommandPalette();
// 或禁用快捷键(仍可受控使用 open/setOpen):
const [open, setOpen] = useCommandPalette({ enabled: false });
return (
  <>
    <CommandPalette open={open} onClose={() => setOpen(false)} />
  </>
);
```

## Properties

### enabled?

> `optional` **enabled?**: `boolean`

Defined in: [ui-react/src/components/CommandPalette.tsx:277](https://github.com/lokvis/lokvis/blob/422c80849e747d15ce61452696529fd726ce6557/packages/ui-react/src/components/CommandPalette.tsx#L277)

是否注册 ⌘K 全局快捷键(默认 true)。设为 false 时仍可受控使用 open/setOpen
