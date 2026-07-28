---
'@lokvis/capability': minor
'@lokvis/engine-pdf': minor
'@lokvis/plugin-pdf': minor
'@lokvis/embed-pdf': minor
'@lokvis/mcp-server': minor
---

新增 PDF 添加页码能力 `pdf.add-page-numbers`(全链路):

- capability:manifest 新增 add-page-numbers action(position/format/startFrom/fontSize/color)+ codegen 生成 `PDF_ADD_PAGE_NUMBERS`
- engine-pdf:新增 `addPageNumbers` operation(pdf-lib,Helvetica,`{n}`/`{total}` 占位符,4 个位置)
- plugin-pdf:注册 `pdf.add-page-numbers`(web/node 真实实现,默认入口 stub,共 8 个 capability:6 真实 + 2 stub)
- embed-pdf:新增 `usePdfPageNumbers` hook(`PDF_PAGE_NUMBER_POSITIONS` / `DEFAULT_PAGE_NUMBER_FORMAT`,position/format/startFrom 变更自动重跑)
- mcp-server:新增 `lokvis_pdf_add_page_numbers` tool(经 runtime.run 走完整 capability 系统)
