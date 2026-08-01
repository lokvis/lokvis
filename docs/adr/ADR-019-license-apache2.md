# ADR-019: 许可证 MIT → Apache-2.0

- 状态: Accepted
- 日期: 2026-08-01
- 决策者: maintainer

## 背景

lokvis-open 初始采用 MIT 许可证。架构 v2 最终态裁决（§2）推荐 Apache-2.0：
Runtime 类项目（涉及 WASM 编解码、FFmpeg 桥接、AI proxy 等）面临专利风险，
Apache-2.0 的专利授权条款（§3）为使用者和贡献者提供额外法律保护。

## 决策

**采用 Apache-2.0**，自 0.10.0 起生效。

### 影响分析

1. **已发布版本不可撤回**：0.9.x 及以前的 MIT 版本永久保持 MIT；
   换协议仅影响 0.10.0+ 的新发布。
2. **外部贡献者**：当前无外部 PR（仓库为 alpha 阶段），无需追溯 CLA。
   后续贡献在 Apache-2.0 下提交即隐含专利授权（§3）。
3. **依赖兼容性**：
   - fflate (MIT) ✓ — MIT 代码可被 Apache-2.0 项目包含
   - pdf-lib (MIT) ✓
   - ffmpeg.wasm / ffmpeg-static (LGPL-2.1+) ✓ — 动态链接，非衍生
   - sharp (Apache-2.0) ✓ — 同协议
   - Dexie (Apache-2.0) ✓
4. **联动修改**：根 LICENSE、NOTICE（新增）、34 个 package.json、README 徽章。

## 替代方案

- **维持 MIT**：更简短、社区更熟悉；但缺专利条款，对 Runtime 类项目保护不足。
- **双许可 MIT + Apache-2.0**：增加复杂度，alpha 阶段无实际需求。

## 后果

- 使用者获得明确的专利授权（贡献者自动授予）。
- 需保留 NOTICE 文件（Apache-2.0 §4(d) 要求）。
- 下游 cloud 仓无需改动（私有代码，仅消费 open 包）。
