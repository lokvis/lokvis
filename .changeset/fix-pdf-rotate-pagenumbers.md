---
'@lokvis/mcp-server': patch
---

修复 lokvis_pdf_rotate 参数透传 bug

- `pdfRotate` 之前将 `pages` 透传为 `transformParams.pages`,但 engine-pdf/manifest 契约使用 `pageNumbers`,导致指定页码从未生效(始终旋转全部页)
- 改为透传为 `pageNumbers`(1-based,与 manifest + engine 语义一致)
- 补充 pdfRotate 端到端测试:默认旋转全部页、`pages: [1]` 仅旋转第 1 页
