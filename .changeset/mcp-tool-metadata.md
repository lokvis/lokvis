---
"@lokvis/mcp-server": minor
---

G4: MCP 工具描述数据化 — 工具 description/inputSchema 改由 codegen 从 capability
manifests + @lokvis/data-formats 格式约束生成（tool-metadata.generated.ts），手工覆盖
（manual-overrides.ts）仅提供 MCP 特有 inputSchema 与描述增强，mirror C1 模式。
新增 drift-guard 测试守卫生成集 ↔ 能力元数据一致性。修复既有 bug：audio 域
lokvis_audio_compress 引用不存在的 audio.compress 能力，改为 lokvis_audio_normalize
（audio.normalize，参数 level dB）。
