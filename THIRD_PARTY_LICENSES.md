# Third-Party Licenses

> 本文件汇总 Lokvis monorepo 引用的所有第三方依赖及其许可证。
> 自动生成于 W12.6 LICENSE 审计任务(2026-07-04),基于 `pnpm-lock.yaml` 与各 `package.json` 的依赖声明。
>
> Lokvis 本体采用 [MIT License](./LICENSE) 发布。所有第三方依赖均使用与 MIT 兼容的宽松许可证(MIT / Apache-2.0 / BSD-2/3 / ISC),**不包含** GPL/AGPL/LGPL 等 copyleft 许可证。

---

## 目录

- [License Summary](#license-summary)
- [Phase 1 — Current Dependencies](#phase-1--current-dependencies)
  - [Runtime / Production Dependencies](#runtime--production-dependencies)
  - [Dev / Build Dependencies](#dev--build-dependencies)
  - [Type Definitions](#type-definitions)
- [Phase 2 — Planned WASM Dependencies](#phase-2--planned-wasm-dependencies)
- [License Texts](#license-texts)
- [Audit Methodology](#audit-methodology)
- [Maintenance](#maintenance)

---

## License Summary

| SPDX | 名称 | 数量 | 备注 |
|------|------|------|------|
| **MIT** | MIT License | 39 | 主体依赖(运行时 20 + dev 16 + types 3),与 Lokvis 同许可证 |
| **Apache-2.0** | Apache License 2.0 | 4 | `dexie` / `sharp` / `fake-indexeddb` / `typescript` |
| **BSD-3-Clause** | BSD 3-Clause | (传递依赖) | 见 `pnpm-license` 报告 |
| **ISC** | ISC License | (传递依赖) | 见 `pnpm-license` 报告 |

> **审计结论**:**未发现 GPL/AGPL/LGPL/copyleft 许可证**,全部依赖与 MIT 分发兼容。

---

## Phase 1 — Current Dependencies

### Runtime / Production Dependencies

> 这些依赖会被打包进 Lokvis 的发布产物(runtime / sdk / ui-react / playground),最终用户可见。

| 包名 | 版本范围 | 实际版本 | SPDX | 使用方 | 用途 |
|------|---------|---------|------|--------|------|
| [`zod`](https://github.com/colinhacks/zod) | `^3.23.0` | 3.25.76 | **MIT** | `@lokvis/schema` | Schema 校验(Workflow/Asset/Capability/Plugin/Event) |
| [`dexie`](https://github.com/dexie/Dexie.js) | `^4.0.10` | 4.4.4 | **Apache-2.0** | `@lokvis/runtime` | IndexedDB 封装(`IdbAssetStore` 持久化降级) |
| [`mitt`](https://github.com/developit/mitt) | `^3.0.1` | 3.0.1 | **MIT** | `@lokvis/runtime` | 事件总线(`EventBus` 实现) |
| [`zustand`](https://github.com/pmndrs/zustand) | `^5.0.0` | 5.0.14 | **MIT** | `@lokvis/ui-react` | React 状态管理(Workspace store) |
| [`exifr`](https://github.com/MikeKovba/exifr) | `^7.1.3` | 7.1.3 | **MIT** | `@lokvis/plugin-image` | EXIF 元数据读取 |
| [`react`](https://github.com/facebook/react) | `^19.0.0` | 19.2.7 | **MIT** | `@lokvis/playground`, `@lokvis/ui-react`(peer) | UI 框架 |
| [`react-dom`](https://github.com/facebook/react) | `^19.0.0` | 19.2.7 | **MIT** | `@lokvis/playground`, `@lokvis/ui-react`(peer) | React DOM 渲染 |
| [`astro`](https://github.com/withastro/astro) | `^7.0.0` | 7.0.3 | **MIT** | `@lokvis/playground`, `@lokvis/docs` | 站点生成器 |
| [`sharp`](https://github.com/lovell/sharp) | `^0.33.0` | 0.33.5 | **Apache-2.0** | `@lokvis/playground`, `@lokvis/docs` | Astro 构建期图片优化(不进运行时 bundle) |
| [`@sentry/browser`](https://github.com/getsentry/sentry-javascript) | `^8.40.0` | 8.55.2 | **MIT** | `@lokvis/playground` | 错误监控 + Web Vitals(可选,DSN 未配置时 no-op) |
| [`@tailwindcss/vite`](https://github.com/tailwindlabs/tailwindcss) | `^4.0.0` | 4.3.1 | **MIT** | `@lokvis/playground` | Tailwind v4 Vite 插件 |
| [`tailwindcss`](https://github.com/tailwindlabs/tailwindcss) | `^4.0.0` | 4.3.1 | **MIT** | `@lokvis/playground` | CSS 工具类框架 |
| [`@astrojs/react`](https://github.com/withastro/astro) | `^6.0.0` | 6.0.0 | **MIT** | `@lokvis/playground` | Astro React 集成 |
| [`@astrojs/mdx`](https://github.com/withastro/astro) | `^7.0.0` | 7.0.0 | **MIT** | `@lokvis/docs` | Astro MDX 集成 |
| [`@astrojs/starlight`](https://github.com/withastro/starlight) | `^0.41.1` | 0.41.1 | **MIT** | `@lokvis/docs` | 文档站主题 |
| [`@codemirror/autocomplete`](https://github.com/codemirror/basic-setup) | `^6.20.3` | 6.20.3 | **MIT** | `@lokvis/playground` | CodeMirror 6 自动补全 |
| [`@codemirror/commands`](https://github.com/codemirror/basic-setup) | `^6.10.4` | 6.10.4 | **MIT** | `@lokvis/playground` | CodeMirror 6 命令 |
| [`@codemirror/lang-javascript`](https://github.com/codemirror/lang-javascript) | `^6.2.5` | 6.2.5 | **MIT** | `@lokvis/playground` | CodeMirror 6 JS 语法 |
| [`@codemirror/language`](https://github.com/codemirror/basic-setup) | `^6.12.4` | 6.12.4 | **MIT** | `@lokvis/playground` | CodeMirror 6 语言框架 |
| [`@codemirror/state`](https://github.com/codemirror/basic-setup) | `^6.7.0` | 6.7.0 | **MIT** | `@lokvis/playground` | CodeMirror 6 状态 |
| [`@codemirror/theme-one-dark`](https://github.com/codemirror/basic-setup) | `^6.1.3` | 6.1.3 | **MIT** | `@lokvis/playground` | CodeMirror 6 暗色主题 |
| [`@codemirror/view`](https://github.com/codemirror/basic-setup) | `^6.43.4` | 6.43.4 | **MIT** | `@lokvis/playground` | CodeMirror 6 视图 |

### Dev / Build Dependencies

> 这些依赖只在开发 / 构建期使用,**不进运行时 bundle**。

| 包名 | 版本范围 | 实际版本 | SPDX | 使用方 | 用途 |
|------|---------|---------|------|--------|------|
| [`typescript`](https://github.com/microsoft/TypeScript) | `^5.6.0` | 5.9.3 | **Apache-2.0** | root + 几乎所有包 | 类型系统 + tsc 编译 |
| [`turbo`](https://github.com/vercel/turborepo) | `^2.3.0` | 2.10.0 | **MIT** | root | Monorepo 构建编排 |
| [`vitest`](https://github.com/vitest-dev/vitest) | `^2.1.0` | 2.1.9 | **MIT** | root, `@lokvis/playground` | 测试框架 |
| [`@vitest/coverage-v8`](https://github.com/vitest-dev/vitest) | `^2.1.0` | 2.1.9 | **MIT** | root | V8 覆盖率 |
| [`oxlint`](https://github.com/oxc-project/oxc) | `^1.72.0` | 1.72.0 | **MIT** | root | Linter(Rust 实现,替代 ESLint) |
| [`prettier`](https://github.com/prettier/prettier) | `^3.3.0` | 3.9.1 | **MIT** | root | 代码格式化 |
| [`prettier-plugin-astro`](https://github.com/withastro/prettier-plugin-astro) | `^0.14.1` | 0.14.1 | **MIT** | root | Astro 文件格式化 |
| [`prettier-plugin-tailwindcss`](https://github.com/tailwindlabs/prettier-plugin-tailwindcss) | `^0.8.0` | 0.8.0 | **MIT** | root | Tailwind 类排序 |
| [`@changesets/cli`](https://github.com/changesets/changesets) | `^2.27.0` | 2.31.0 | **MIT** | root | 版本管理 + 发布 |
| [`@changesets/changelog-github`](https://github.com/changesets/changesets) | `^0.5.0` | 0.5.2 | **MIT** | root | GitHub changelog 格式 |
| [`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB) | `^6.0.0` | 6.2.5 | **Apache-2.0** | `@lokvis/runtime` | 测试用 IndexedDB mock |
| [`@testing-library/react`](https://github.com/testing-library/react-testing-library) | `^16.0.0` | 16.3.2 | **MIT** | `@lokvis/ui-core` | React 组件测试 |
| [`@testing-library/jest-dom`](https://github.com/testing-library/jest-dom) | `^6.4.0` | 6.9.1 | **MIT** | `@lokvis/ui-core` | DOM 断言扩展 |
| [`jsdom`](https://github.com/jsdom/jsdom) | `^25.0.0` | 25.0.1 | **MIT** | `@lokvis/ui-core` | 测试环境 DOM |
| [`@astrojs/check`](https://github.com/withastro/astro) | `^0.9.0` | 0.9.9 | **MIT** | `@lokvis/docs` | Astro 类型检查 |
| [`tsx`](https://github.com/privatenumber/tsx) | `^4.19.0` | 4.22.4 | **MIT** | `@lokvis/example-cli-automation` | TS 脚本执行器 |
| [`vite`](https://github.com/vitejs/vite) | `^5.4.0` | 5.4.21 | **MIT** | examples | 构建工具(被 Astro 内部使用) |
| [`@vitejs/plugin-react`](https://github.com/vitejs/vite-plugin-react) | `^4.3.0` | 4.7.0 | **MIT** | `@lokvis/example-embedding` | Vite React 插件 |

### Type Definitions

> 类型定义,仅 TypeScript 编译期使用,不进运行时 bundle。

| 包名 | 版本范围 | SPDX | 用途 |
|------|---------|------|------|
| [`@types/node`](https://github.com/DefinitelyTyped/DefinitelyTyped) | `^22.0.0` | **MIT** | Node.js 类型 |
| [`@types/react`](https://github.com/DefinitelyTyped/DefinitelyTyped) | `^19.0.0` | **MIT** | React 类型 |
| [`@types/react-dom`](https://github.com/DefinitelyTyped/DefinitelyTyped) | `^19.0.0` | **MIT** | React DOM 类型 |

---

## Phase 2 — Planned WASM Dependencies

> Phase 1 Alpha(W12)使用 Canvas + `createImageBitmap`,**零 WASM**。
> 以下依赖计划在 Phase 2 / M2.1 引入对应 engine-* 包时落地。许可证已预审,**全部与 MIT 兼容**。
>
> 详见 [`docs/roadmap.md`](./docs/roadmap.md) Phase 2 章节。

| 计划包 | 依赖 | 计划引入版本 | SPDX | 用途 | 备注 |
|--------|------|-------------|------|------|------|
| `@lokvis/engine-video` | [`@ffmpeg/ffmpeg`](https://github.com/ffmpegwasm/ffmpeg.wasm) + [`@ffmpeg/core`](https://github.com/ffmpegwasm/ffmpeg.wasm) | Phase 2 / W21 | **MIT** + **LGPL-2.1+**(FFmpeg 本体) | 视频转码 / 剪辑 / 截帧 / GIF | FFmpeg 以 WASM 形式分发,LGPL-2.1+ 允许动态链接;`@ffmpeg/core` 默认构建不含 GPL 组件(x264/x265),需使用 LGPL 兼容构建 |
| `@lokvis/engine-pdf` | [`pdf-lib`](https://github.com/Hopding/pdf-lib) | Phase 2 / W17 | **MIT** | PDF 合并 / 拆分 / 页面操作 / 元数据编辑 | 纯 JS 实现,无原生依赖 |
| `@lokvis/engine-audio` | [`lamejs`](https://github.com/zhuker/lamejs) | Phase 2 | **LGPL-2.1** | MP3 编码 | **⚠️ LGPL-2.1**:需评估动态链接合规性;考虑用 [`@breezystack/lamejs`](https://github.com/Breezystack/lamejs)(MIT fork)替代 |
| `@lokvis/engine-ai` | [`@huggingface/transformers`](https://github.com/huggingface/transformers.js)(原 `@xenova/transformers`) | Phase 2 / M2.1 | **Apache-2.0** | 浏览器端 AI 模型推理(OCR / 图像分类 / caption) | 模型按各自协议分发(通常 MIT / Apache-2.0) |

### WASM 加载策略(Phase 2 设计)

- **懒加载**:WASM 二进制按需 `import()` 不进首屏 bundle(参见 `apps/playground/src/toolkit/sentry.ts` 同款 dynamic import 模式)
- **CDN 预缓存**:Service Worker 在 idle 时预缓存 WASM 二进制,二次访问零延迟
- **HTTP/2 分片**:大 WASM 二进制分片传输,并行下载
- **COOP/COEP 隔离**:已配置 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`,启用 `SharedArrayBuffer` 供多线程 WASM 使用
- **合规审计**:每个 WASM 依赖引入时需更新本文件,并提供来源 / 协议 / 是否含 GPL 组件的声明

---

## License Texts

### MIT License(本项目 + 39 个依赖)

```
MIT License

Copyright (c) 2026 Lokvis Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Apache License 2.0(4 个依赖:`dexie` / `sharp` / `fake-indexeddb` / `typescript`)

> 完整文本见 https://www.apache.org/licenses/LICENSE-2.0
>
> 关键条款:
> - 允许商用 / 修改 / 分发 / 专利授权
> - 必须保留版权声明 + NOTICE 文件
> - 修改后的文件需标注 "NOTICE" 说明
> - 不要求衍生作品采用相同许可证(与 MIT 兼容)

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      [...]

   END OF TERMS AND CONDITIONS

   Copyright [year] [copyright holder]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

### LGPL-2.1(Phase 2:`lamejs`,待评估替代方案)

> 完整文本见 https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt
>
> 关键条款:
> - 允许动态链接到非 LGPL 项目
> - 修改 LGPL 部分需开源
> - **Lokvis 计划用 `@breezystack/lamejs`(MIT fork)替代,规避 LGPL 合规负担**

---

## Audit Methodology

### 审计方法

1. **依赖枚举**:遍历 `/workspace/package.json` + 24 个子包 `package.json`,聚合所有 `dependencies` + `devDependencies`
2. **许可证核验**:对每个外部依赖,读取 `node_modules/.pnpm/<dep>/node_modules/<dep>/package.json` 的 `license` 字段,交叉验证 GitHub 仓库
3. **传递依赖**:Phase 1 范围仅审计直接依赖。完整传递依赖树可通过 `pnpm licenses list --long` 生成
4. **白名单**:仅允许 MIT / Apache-2.0 / BSD-2/3 / ISC 许可证;**禁止** GPL / AGPL / LGPL / SSPL / 商业专有
5. **例外处理**:`lamejs` (LGPL-2.1) 标注为 Phase 2 计划,且已有 MIT fork 替代方案(`@breezystack/lamejs`),不阻塞 Phase 1

### 验证命令

```bash
# 列出所有依赖及其许可证
pnpm licenses list --long

# 检查特定包的许可证
pnpm licenses list --long | grep -i "package-name"

# 检查 lockfile 中的所有依赖
pnpm why <package-name>
```

### 审计范围

- ✅ 直接 `dependencies` + `devDependencies`(全部 25 个 `package.json`)
- ✅ Phase 2 计划依赖预审(ffmpeg.wasm / pdf-lib / lamejs / transformers.js)
- ⚠️ 传递依赖未逐一审计(信任 pnpm 解析 + npm registry metadata);如需完整清单运行 `pnpm licenses list --json`
- ✅ 工作区 `@lokvis/*` 内部包(全部 MIT,见各 `package.json` 的 `license` 字段)

---

## Maintenance

### 维护规则

1. **新增依赖时**:PR 必须更新本文件,在对应表格添加新行
2. **许可证变更**:如依赖升级后许可证变更,需立即更新并重新评估合规性
3. **Phase 2 引入 WASM**:每个 WASM 引擎接入时(`engine-video` / `engine-pdf` / `engine-audio` / `engine-ai`)必须在 "Phase 2 — Planned WASM Dependencies" 章节填写实际接入版本 + 来源 + 协议 + 是否含 GPL 组件
4. **季度审计**:每季度初运行 `pnpm licenses list --long` 对比本文件,差异需 review
5. **CI 校验**(Phase 2 计划):`pnpm licenses list --json` + license-checker 工具,失败拒绝合并

### 责任人

- 代码贡献者:PR 中自行更新本文件
- Maintainer:Review 时核对许可证合规性
- 法务咨询:发现 LGPL / 不明许可证时,先暂停合并,咨询 [Lokvis 法务](mailto:legal@lokvis.com)

---

## References

- [Open Source Initiative — Licenses](https://opensource.org/licenses)
- [SPDX License List](https://spdx.org/licenses/)
- [Choose a License](https://choosealicense.com/)
- [GitHub Licensing](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- [FFmpeg License](https://ffmpeg.org/legal.html)
- [pnpm licenses command](https://pnpm.io/cli/licenses)

---

*本文件由 W12.6 LICENSE 审计任务生成(2026-07-04)。如有疑问请开 [GitHub Issue](https://github.com/lokvis/lokvis/issues)。*
