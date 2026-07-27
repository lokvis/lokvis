# PDF 工具 0.7.0 实现方案：add-page-numbers 全链路 + split 自定义页数

> 状态：Proposed · 2026-07-27
> 需求来源：lokvis-cloud Tool 页缺口（`/pdf/tools/add-page-numbers` 显示 coming soon；`/pdf/tools/split` 仅 3 个固定预设）

---

## 1. 背景与现状

| 能力 | manifest | engine-pdf | plugin-pdf (web/node) | embed-pdf hook | 结论 |
|------|----------|-----------|----------------------|----------------|------|
| `pdf.add-page-numbers` | ❌ 无 action | ❌ 无实现 | ❌ 未注册 | ❌ 无 hook | 仅 `capability/src/names.ts:66` 有名字常量，全链路缺失 |
| `pdf.split` 自定义页数 | ✅ `pagesPerFile` / `ranges` | ✅ `splitPdf` 完整支持（含越界校验） | ✅ 已注册真实实现 | ❌ `usePdfSplit` 只暴露 3 个固定预设（1/2/5 页） | 缺口仅在 hook 层 |

cloud 侧 `/pdf/tools/add-page-numbers` frontmatter 已定义预设参数（position: bottom-center、format: `Page {n} of {total}`、startFrom: 1、fontSize: 10、color: #666666），本方案参数设计与其对齐。

---

## 2. 方案 A：`pdf.add-page-numbers` 全链路实现

模式全部对齐现有 `pdf.watermark` 链路（同为 1→1 逐页 drawText）。

### 2.1 capability — manifest 新增 action

`packages/capability/manifests/pdf.manifest.json` 追加：

```json
{
  "action": "add-page-numbers",
  "description": "Add page numbers to a PDF",
  "inputTypes": ["pdf"],
  "outputTypes": ["pdf"],
  "params": [
    { "name": "position", "type": "enum", "values": ["bottom-center", "bottom-right", "top-center", "top-right"], "default": "bottom-center", "description": "页码位置" },
    { "name": "format", "type": "string", "default": "Page {n} of {total}", "description": "格式模板，支持 {n} / {total} 占位符" },
    { "name": "startFrom", "type": "number", "default": 1, "min": 1, "description": "起始页码" },
    { "name": "fontSize", "type": "number", "default": 10 },
    { "name": "color", "type": "color", "default": "#666666" }
  ],
  "performance": "fast",
  "batchable": true
}
```

- 跑 `pnpm codegen` 重新生成 `pdf.generated.ts`（新增 `PDF_ADD_PAGE_NUMBERS: Capability` 并加入 `PDF_CAPABILITIES` 数组）
- `names.ts` 常量已存在，无需改动

### 2.2 engine-pdf — 真实实现

`src/operations.ts` 新增 `addPageNumbers(blob, params)`（仿 `addWatermark`，~60 行）：

- 参数校验（fail-loud）：position 枚举内、fontSize > 0、startFrom ≥ 1 整数、format 非空字符串
- pdf-lib 动态 `import`（不进首屏 bundle）→ `PDFDocument.load` → `embedFont(StandardFonts.Helvetica)`
- 逐页文本：`format.replace('{n}', String(startFrom + i)).replace('{total}', String(startFrom + pages.length - 1))`
- 定位（margin = 36pt）：
  - x：`*-center` → `(width - textWidth) / 2`；`*-right` → `width - textWidth - margin`
  - y：`bottom-*` → `margin`；`top-*` → `height - margin - fontSize`
- 复用现有 `parseHexColor` / `blobToArrayBuffer` / `uint8ToBlobPart`
- 新增 `PdfAddPageNumbersParams` 类型；`src/index.ts` 导出
- `__tests__/operations.test.ts` 用例：输出页数不变、startFrom 偏移生效、{n}/{total} 替换正确、非法 position / 空 format / startFrom < 1 抛错

### 2.3 plugin-pdf — 三处注册

1. `src/operations.ts`（默认入口，全 stub）：新增 `addPageNumbersOp` stub + `PDF_OPERATION_ENTRIES` 追加
   `{ capability: 'pdf.add-page-numbers', engine: 'pdf-lib', kind: 'single', outputType: 'pdf', operation: addPageNumbersOp }`
2. `src/web-plugin.ts`：import `addPageNumbers`，新增 `createBlobCapabilityImpl`（`isStub: false`），头注释与注册日志更新为 "6 真实 + 2 stub"
3. `src/node-plugin.ts`：同样绑定真实实现
4. 测试：`plugin.test.ts` / `node-plugin.test.ts` 的能力名断言与 realCaps 列表加 `'pdf.add-page-numbers'`

### 2.4 embed-pdf — Layer 0 hook

新建 `src/hooks/usePdfPageNumbers.ts`（仿 `usePdfWatermark` 的 autoRun / 参数变更重跑 / onComplete 模式）：

- 导出类型与常量：`PdfPageNumberPosition`、`PDF_PAGE_NUMBER_POSITIONS`（4 值数组）、`DEFAULT_PAGE_NUMBER_FORMAT = 'Page {n} of {total}'`
- options：`{ initialPosition?, initialFormat?, initialStartFrom?, fontSize?, color?, autoRun?, onComplete?, plugins? }`
- 返回：`usePdfTool` 透传字段（ready/initError/input*/output*/busy/error/reset/clearError）+ `position/setPosition`、`format/setFormat`、`startFrom/setStartFrom`（setter 触发重跑，同 `setText` 模式）+ `run`；复用 `PdfActionResult`
- workflow：`buildSingleStepPdfWorkflow('pdf.add-page-numbers', params, 'PdfAddPageNumbers', 'Add page numbers to PDF')`
- `hooks/index.ts` 导出

### 2.5 mcp-server（lockstep 建议项）

`src/tools/pdf.ts` 对齐 `pdf.watermark` 模式注册 `lokvis_pdf_add_page_numbers`。

---

## 3. 方案 B：`usePdfSplit` 自定义页数

engine / manifest / plugin 均已支持任意 `pagesPerFile`（`splitPdf` 含正整数校验与 `ranges` 优先逻辑），**仅需改 hook 层**：

`packages/embed-pdf/src/hooks/usePdfSplit.ts`：

- `PdfSplitPreset` 增加 `'custom'`：`export type PdfSplitPreset = 'every-page' | '2-pages' | '5-pages' | 'custom'`
- `PDF_SPLIT_PRESETS` 增加 `custom: { pagesPerFile: 0 }`（占位，实际值来自 state）
- 新增 state `pagesPerFile`（默认取当前预设值）与 `setPagesPerFile(n: number)`：
  - 设值时自动切到 `custom` 预设并重跑（同 `usePdfWatermark.setText` 模式）
  - `n < 1` 或非整数时不触发 run（由 UI 层约束，engine 侧仍有 fail-loud 兜底）
- `runSplit` 参数来源：`custom` 预设 → state 值；其余 → 预设表
- options 增加 `initialPagesPerFile?: number`（传入时初始预设为 `custom`）
- 返回值增加 `pagesPerFile` / `setPagesPerFile`

`ranges`（按范围拆分）暂不进 hook：属进阶场景，引导 full workspace，避免 hook API 复杂化。

---

## 4. 发布计划

- 纯新增能力，无破坏性变更 → 全家桶 lockstep **0.7.0**
- 发布顺序：capability → engine-pdf → plugin-pdf → embed-pdf → mcp-server（其余包版本号跟随）
- 各包补 CHANGELOG：
  - capability：新增 `pdf.add-page-numbers` manifest action + codegen
  - engine-pdf：新增 `addPageNumbers` operation
  - plugin-pdf：注册 `pdf.add-page-numbers`（web/node 真实，默认入口 stub）
  - embed-pdf：新增 `usePdfPageNumbers` hook；`usePdfSplit` 支持 `custom` 预设与 `pagesPerFile` 自定义

---

## 5. cloud 侧接入（参考，非本仓库范围）

发布 0.7.0 后 lokvis-cloud 侧：

1. 依赖升级至 0.7.0
2. `ContentLayout.astro`：`QUICK_PDF_TOOLS` 加入 `'pdf.add-page-numbers'`
3. `QuickPdfShell.tsx`：
   - 新增页码工具 UI（位置 pills × 4 + 格式输入 + 起始页输入），frontmatter `workspacePreset` 预填
   - split 工具 UI 增加 "Custom" pill + 每文件页数输入（`setPagesPerFile`）
4. i18n（en/zh/ja）补充对应文案

---

## 6. 验证清单

- [ ] `pnpm codegen` 后 `pdf.generated.ts` 含 `PDF_ADD_PAGE_NUMBERS`
- [ ] engine-pdf 单测：页码渲染 / startFrom / 占位符 / 参数校验
- [ ] plugin-pdf 单测：web/node 注册数 8（6 真实 + 2 stub）
- [ ] embed-pdf：`usePdfPageNumbers` 输出正确；`usePdfSplit` custom 预设输出文件数 = ceil(总页数 / pagesPerFile)
- [ ] mcp-server：`lokvis_pdf_add_page_numbers` 可调用
- [ ] cloud dev server：`/pdf/tools/add-page-numbers` 正常处理并可下载；`/pdf/tools/split` 自定义页数生效
