---
"@lokvis/cli": patch
---

- `run` 命令使用 `new File([blob], name, { type })` 替代不可靠的 `{ ...blob, name } as unknown as File` 强转
