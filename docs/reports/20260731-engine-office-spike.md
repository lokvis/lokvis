# engine-office 技术选型 Spike 报告

- 日期:2026-07-31
- 时间盒:4h（仅评估,不实现）
- 关联:`docs/architecture-v2-tasks.md` G2、ADR-016(Engine 契约)、ADR-017(archive.* 域)
- 结论:**No-Go(本迭代)**;office 归入 Y2 后半,先做 spike 冻结选型,不进入 0.x 发布物

## 目标

评估在 lokvis 六层架构下引入 `@lokvis/engine-office` 的可行性:能否以"Blob↔Blob
纯函数 + 描述符"形态(ADR-016)提供 docx / xlsx 的读/写/转换,且在**浏览器内存**
约束下可用。产出 go/no-go 建议与推荐路线,不落任何实现代码。

## 候选库盘点

### DOCX

| 库 | 能力 | 形态 | 体积(min+gz) | 许可 | 同构 | 备注 |
|----|------|------|------|------|------|------|
| `docx`(dolanmiu) | **写**(生成 .docx) | 纯 JS | ~110KB | MIT | ✅ | 只写不读;API 以段落/表格对象树构建 |
| `mammoth` | **读**(.docx → HTML/文本) | 纯 JS | ~90KB | BSD-2 | ✅ | 只读;丢失复杂样式,适合抽取正文 |
| `docxtemplater` | 模板填充 | 纯 JS | ~70KB | 开源核心 + 付费模块 | ✅ | 高级功能(循环/图片)需付费模块,许可风险 |

> docx 的"读"与"写"分属两个库(mammoth 读 / docx 写),无单库覆盖全读写。
> 若只需"docx → 文本/HTML"抽取(喂 AI / 预览),mammoth 单库即可,成本最低。

### XLSX

| 库 | 能力 | 形态 | 体积 | 许可 | 同构 | 备注 |
|----|------|------|------|------|------|------|
| SheetJS 社区版(`xlsx`) | 读/写 全格式 | 纯 JS | ~200KB | Apache-2.0(社区版) | ✅ | **许可/分发风险**:npm 上 `xlsx` 已由官方从 npm 撤下,改为自托管 CDN 分发;社区版功能受限,样式/图表在 Pro |
| `exceljs` | 读/写 + 样式 | 纯 JS | ~280KB | MIT | ✅ | 维护活跃度下降;样式支持较全;体积偏大 |
| `write-excel-file` / `read-excel-file` | 读/写(轻量) | 纯 JS | ~40KB 各 | MIT | ✅ | 只覆盖简单表格,无公式/样式 |

> SheetJS 社区版的分发方式变化(不再走 npm registry 主线)对 lockfile / CI
> `--frozen-lockfile` 与 changeset 发布链是实际风险点;exceljs 许可干净(MIT)
> 但体积大、维护放缓。轻量库(write/read-excel-file)许可干净、体积小,但能力弱。

## 浏览器内存可行性

- office 文件本质是 zip 容器(OOXML)。解析需整包解压到内存 + 构建对象树,
  峰值内存约为**文件大小的 5–15×**(xlsx 含大量单元格时更高)。
- 典型场景(< 5MB 文档)在桌面浏览器可行;但 20MB+ 的 xlsx(数万行)会触及
  Runtime `MemoryGuard`(L4)阈值,存在 OOM 风险。
- 与 archive(fflate 流式)不同,office 库多为**一次性全量解析**,无流式 API,
  难以与 MemoryGuard 的分块策略配合。
- 结论:内存可行但有上限;需在 plugin 层用 MemoryGuard 做大文件门控 + 明确
  "浏览器端仅支持中小文档,大文档走 Node/远端"的分层(参考 pdf/video 的
  浏览器 stub + `/node` 实装模式)。

## 架构契合度

- 纯函数形态可满足:`readDocxText(blob) → Blob(text/html)`、
  `writeXlsx(rows) → Blob`。符合 ADR-016 引擎契约。
- 但 office 能力天然"结构化"(表格/单元格/样式),与 lokvis 现有 media-centric
  Asset 模型(image/video/audio/pdf)语义距离较大;`data` 类型可承载,
  但 UI/workflow 表达力有限,价值主要面向 **AI Runtime 的文档抽取/生成**
  (与"AI 后面的 Runtime"定位相关)而非可视化编辑。

## 推荐路线(冻结,待 Y2 后半启动)

1. **分阶段最小面**:首版只做**读抽取**(docx→text via mammoth,
   xlsx→JSON via read-excel-file),输出 `text` / `application/json` data Asset,
   服务 AI OCR/摘要/结构化;**不做写/样式保真**。
2. **库选型**:docx 读用 `mammoth`(BSD-2);xlsx 读用 `read-excel-file`(MIT,
   体积小);**规避 SheetJS 分发风险与 docxtemplater 付费模块**。写能力(docx 生成
   用 `docx`、xlsx 生成用 `write-excel-file`)列为二期,视需求再评。
3. **形态**:同 pdf —— 默认浏览器入口 stub / `@lokvis/engine-office/node` 实装,
   或按体积做动态 import 懒加载;plugin 层接 MemoryGuard 大文件门控。
4. **域命名**:新建 `office.*` 域(`office.docx-to-text` / `office.xlsx-to-json` …),
   codegen 走 manifest,与 archive.* 一致。

## Go/No-Go

- **No-Go(0.x 本迭代)**:价值集中在 AI 文档链路,当前无明确消费方;
  SheetJS 分发风险 + 内存上限 + 结构化语义距离,使 ROI 低于 archive/FilePicker。
- **Go 条件(Y2 后半)**:当 AI Runtime 需要文档抽取(RAG/摘要)时,按上述
  "只读抽取最小面 + mammoth/read-excel-file"启动,单独 ADR 固化选型与内存策略。
