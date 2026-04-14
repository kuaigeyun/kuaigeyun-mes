# 打印模板能力矩阵（RiverEdge）

本文档描述单据打印在 **模板类型**、**调用端** 与 **输出格式** 下的支持情况，并与 [`DocumentPrintService.print_document`](riveredge-backend/src/apps/kuaizhizao/services/print_service.py) 行为对齐。

## 术语

| 术语 | 含义 |
|------|------|
| **pdfme 模板** | `content` 为 pdfme JSON（含 `basePdf` / `schemas`），由 `@pdfme/generator` 在浏览器内成稿 |
| **HTML/占位符模板** | `content` 为 HTML 或含 `{{key}}` 的文本，由后端 `render_plain_template` / `render_template_to_html` 渲染 |
| **默认版式** | 未配置模板或模板不可用时，`_generate_default_print` 生成的简易键值表 HTML |

## 矩阵：模板类型 × 端 × 输出

| 模板类型 | 浏览器（推荐） | `GET .../print` JSON | `GET .../print` → PDF（base64） |
|----------|----------------|----------------------|----------------------------------|
| **pdfme** | 拉取 `print-variables`（或与页面数据一致的变量）+ 前端 `generate` | `render_mode: "client_pdfme"`，`content` 为空，**不再**返回默认 HTML 冒充设计稿 | 同上，不产生服务端 PDF |
| **HTML/`{{key}}`** | 可调 `/print` 取 HTML 或自行预览 | 返回渲染后的 `content` | 经 WeasyPrint 或 xhtml2pdf 转 PDF（见下节） |
| **无模板** | — | 默认版式 HTML | 默认版式 → PDF |

## 数据源（变量）

- 与 [`DocumentPrintService._get_document_data`](riveredge-backend/src/apps/kuaizhizao/services/print_service.py) 一致。
- 已暴露 **print-variables** 的路由（供 pdfme 使用，避免与 HTML 路径分叉）：
  - `GET /apps/kuaizhizao/quotations/{id}/print-variables`
  - `GET /apps/kuaizhizao/sales-orders/{id}/print-variables`
  - `GET /apps/kuaizhizao/work-orders/{id}/print-variables`

## HTML → PDF 引擎（服务端）

由环境变量 **`RIVEREDGE_HTML_TO_PDF_ENGINE`** 控制（见 `print_service._html_to_pdf_bytes`）：

| 值 | 行为 |
|----|------|
| `auto`（默认） | 优先 WeasyPrint，失败则 xhtml2pdf |
| `weasyprint` | 仅 WeasyPrint |
| `xhtml2pdf` | 仅 xhtml2pdf（免 GTK，版式可能与 WeasyPrint 不同） |

生产环境若需版式稳定，建议在 Linux 镜像中安装 WeasyPrint 依赖并设 `weasyprint`。

## 相关前端工具

- [`printResponseHelpers`](../riveredge-frontend/src/utils/printResponseHelpers.ts)：识别 `client_pdfme` 响应并提示用户。
- [`pdfmeClientPrint`](../riveredge-frontend/src/utils/pdfmeClientPrint.ts)：统一的 `generate` + 字体预加载 + 打印窗口。

## Node 子进程生成 pdfme（可选）

见 [pdfme-node-subprocess.md](./pdfme-node-subprocess.md)。
