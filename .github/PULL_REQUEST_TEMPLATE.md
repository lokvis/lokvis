<!--
感谢你的 PR!请按以下模板填写。
PR 标题必须遵循 Conventional Commits(如 `feat(runtime): 支持 image.filter 滤镜`)。
详细流程见 CONTRIBUTING.md。
-->

## 变更说明

<!-- 这段 PR 做了什么?为什么?关联 Issue 用 "Closes #123" / "Refs #456"。 -->

Closes #

## 变更类型

- [ ] `feat` 新功能
- [ ] `fix` Bug 修复
- [ ] `docs` 文档
- [ ] `refactor` 重构(无行为变化)
- [ ] `test` 测试
- [ ] `chore` 构建 / 工具链
- [ ] `perf` 性能优化

## 架构影响

<!-- 勾选所有适用项。五层架构严格单向依赖,跨层引用会被 reject。 -->

- [ ] 不涉及架构变更
- [ ] UI(`apps/playground` / `@lokvis/ui-react` / `@lokvis/ui-core`)
- [ ] Workflow(`@lokvis/workflow`)
- [ ] Runtime(`@lokvis/runtime`)
- [ ] Capability(`plugin-*` / `@lokvis/capability`)
- [ ] Engine(`engine-*`)
- [ ] Schema(`@lokvis/schema`)

## 验证

<!-- 提交前必须全部通过。在每项后面贴关键输出或截图。 -->

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm test:fast` 通过(或 `pnpm test:coverage`)
- [ ] `pnpm lint` 无 error
- [ ] 新功能已配测试(单元 / E2E)
- [ ] 手动验证(如涉及 UI / 浏览器 API)

## Breaking Changes

- [ ] 无 Breaking Change
- [ ] 有 Breaking Change(请在下方说明影响 + 迁移路径)

<!-- 如有 Breaking Change,请详细描述:
1. 影响的 API / 行为
2. 用户 / 集成方的迁移步骤
3. 是否需要 changeset(major bump)
-->

## Checklist

- [ ] PR 标题遵循 Conventional Commits
- [ ] 单一职责(一个功能 / 一个 bug / 一类重构)
- [ ] diff 控制在 ~500 行内(不含 lockfile / 生成代码)
- [ ] 未引入 GPL / AGPL 代码到主 bundle
- [ ] 引入新依赖已在 THIRD_PARTY_LICENSES.md 登记
- [ ] 未在代码 / 提交中包含真实用户文件 / token / DSN

## 补充说明

<!-- 截图、性能数据、设计权衡、待跟进项等。 -->
