---
"@lokvis/engine-video": minor
"@lokvis/engine-audio": minor
"@lokvis/engine-pdf": minor
"@lokvis/plugin-video": patch
"@lokvis/plugin-audio": patch
"@lokvis/plugin-pdf": patch
---

修复 stub 检测契约漂移(架构评审 #8)。

engine-video / engine-audio / engine-pdf 各入口现导出带 `version` 的引擎描述符(`VIDEO_ENGINE` / `AUDIO_ENGINE` / `PDF_ENGINE`),遵循 AGENTS.md「version 含 'stub' 即占位实现」约定:默认(浏览器)入口 version 含 `-stub`,`node` / `web` 真实入口不含。

plugin-video / plugin-audio / plugin-pdf 恢复 `version.includes('stub')` 单点推导:

- 删除各 plugin 中硬编码的 `isStub = true` / `isStub: false`(此前与引擎实际能力脱钩),改为从对应引擎描述符推导。
- 引擎名(`BROWSER_ENGINE` / `PLUGIN_ENGINE_NODE` / `PLUGIN_ENGINE_WEB` / `PLUGIN_ENGINE_PDF`)统一取自描述符 `name` 字段,消除字面量重复。
- plugin-pdf 保留 `REAL_STUB_CAPABILITIES`(ocr/sign 按能力叠加),最终 `isStub = engine 级 stub || 能力级未实装`,与 engine-image 的 `canvasEngine.version` 推导模式对齐。
