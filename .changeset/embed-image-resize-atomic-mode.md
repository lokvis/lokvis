---
"@lokvis/embed-image": patch
---

fix(embed-image): useImageResize 模式状态改为 reducer 原子提交,消除 setPreset/setCustomSize 连续调用竞态

- 原实现 setPreset/setCustomSize 各自捕获对方旧闭包,连续调用(如 setPreset 后立即 setCustomSize)产生竞态,workflow 参数与最终状态不一致
- 改用 useReducer 管理 preset/customSize 互斥模式状态:setPreset 原子清空 customSize,setCustomSize 原子切换自定义模式,单次状态提交只触发一次 workflow
- 统一触发 effect 以 `inputId|preset|customSize` 复合 key 去重,保留 autoRun 门控与 busy 丢弃语义
- setter 为纯 dispatch 包装([] deps),引用稳定,可安全放入下游 effect 依赖
