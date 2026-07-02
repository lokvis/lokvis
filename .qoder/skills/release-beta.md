---
name: release-beta
description: 发布 @lokvis/* 包的新 beta 版本。执行 typecheck + 测试,进入 pre 模式,生成 changeset,版本提升,提交并发布到 npm beta 标签。
---

# 发布 Beta 版本

为 `@lokvis/*` 包发布新的 beta 版本到 npm。

## 前置检查

1. **确认分支**:必须位于 `dev` 分支(beta 发布分支)
   ```bash
   git branch --show-current
   ```
   若不在 dev,提示用户切换。

2. **确认工作区干净**:无未提交修改
   ```bash
   git status --short
   ```

3. **运行 typecheck**:确保所有包类型检查通过
   ```bash
   pnpm turbo typecheck
   ```

4. **运行测试**:确保所有测试通过
   ```bash
   pnpm vitest run
   ```

## 进入 Pre 模式

检查是否已在 pre 模式(查看 `.changeset/pre.json` 是否存在):

- **若未进入**:执行 `pnpm changeset pre enter beta`
- **若已进入**:跳过,继续下一步

## 生成 Changeset

询问用户本次 beta 包含哪些变更,或根据最近的 git 提交自动推断:

```bash
git log --oneline v0.1.0..HEAD  # 或上一个 tag
```

为每个有用户可见变更的包创建独立的 changeset 文件(位于 `.changeset/`):

- **Minor bump**:新功能、新 API(向后兼容)
- **Patch bump**:bug 修复、内部重构

**格式**:每个 changeset 文件以 `---` 包裹的 frontmatter 开始:

```markdown
---
"@lokvis/schema": minor
---

- 具体变更描述(中文,使用 `- ` 列表)
```

**原则**:
- 每个包一个 changeset 文件(避免 changelog 交叉污染)
- 只列出直接变更的包;级联依赖(通过 `updateInternalDependencies: patch`)会自动处理
- 描述要具体:列出新增的 API、字段、行为变化

## 版本提升

```bash
pnpm version-packages
```

验证输出:
- 所有 `packages/*/package.json` 版本已提升到 `X.Y.Z-beta.N`
- 所有 `packages/*/CHANGELOG.md` 已生成
- `.changeset/pre.json` 记录了 initialVersions

## 提交

```bash
git add .changeset/ packages/*/package.json packages/*/CHANGELOG.md package.json pnpm-lock.yaml
git commit -m "chore: enter beta pre mode (X.Y.Z-beta.N)"
```

提交信息应包含:
- Minor bumps 列表(包名 + 主要变更)
- Patch bumps 列表(包名 + 主要变更)
- 级联包列表
- 手动发布命令提示

## 推送与发布

**提示用户手动执行**:

```bash
# 推送到 dev
git push origin dev

# 发布到 npm(beta 标签)
pnpm changeset publish --tag beta

# 打 tag
git tag vX.Y.Z-beta.N -m "Beta X.Y.Z-beta.N"
git push origin vX.Y.Z-beta.N
```

## 验证

发布后验证:

```bash
# 检查 npm 上的版本
npm view @lokvis/schema dist-tags --json
npm view @lokvis/runtime dist-tags --json

# 用户应能看到 beta 标签指向新版本
```

## 退出 Beta(发布 stable 时)

当准备发布 stable 时:

```bash
pnpm changeset pre exit
pnpm version-packages
git add . && git commit -m "chore: release X.Y.Z"
# 合并到 main,打 tag,发布 latest
```

## 注意事项

- **不要自动执行 `pnpm changeset publish`** — 发布是不可逆操作,需用户确认
- **不要 force push** — dev 分支可能有其他协作者
- **CHANGELOG 格式错误** — 若 `version-packages` 报 `prettier-plugin-astro` 缺失,需先安装:
  ```bash
  pnpm add -Dw prettier-plugin-astro prettier-plugin-tailwindcss
  ```
- **`@lokvis/web` 已不存在** — `.changeset/config.json` 的 ignore 列表只应包含 `@lokvis/playground` 和 `@lokvis/docs`
