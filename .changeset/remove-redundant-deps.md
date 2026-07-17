---
"@lokvis/engine-core": patch
"@lokvis/ui-core": patch
"@lokvis/cli": patch
---

移除 4 处冗余依赖声明(Task F):

- engine-core:移除 @lokvis/schema(src 未导入,仅注释提及)
- ui-core:移除 @lokvis/schema(src 无任何 @lokvis import)
- cli:移除 @lokvis/runtime(src 经 @lokvis/sdk 传递使用,无直接 import)
- engine-image-node:随包删除一起消失(问题 B 已处理)

避免假依赖信号(消费方/审计工具误以为这些包依赖 schema/runtime)。
