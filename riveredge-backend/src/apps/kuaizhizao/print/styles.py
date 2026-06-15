"""快制造打印预置 — 共享样式与 Jinja2 骨架构建。"""

from __future__ import annotations

PRINT_STYLE_A4 = """
<style>
  @page { size: A4; margin: 14mm 12mm 16mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0; padding: 0;
    font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt; line-height: 1.55; color: #1e293b;
  }
  .report { max-width: 186mm; margin: 0 auto; }
  .report-header {
    border-bottom: 2px solid #0f4c81;
    padding-bottom: 10px; margin-bottom: 14px;
    display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;
  }
  .report-title { margin: 0; font-size: 20pt; font-weight: 700; color: #0f4c81; letter-spacing: 0.5px; }
  .doc-meta { text-align: right; font-size: 9.5pt; color: #475569; }
  .doc-meta strong { display: block; font-size: 11pt; color: #0f172a; margin-bottom: 2px; }
  .section { margin-bottom: 14px; }
  .section-title {
    font-size: 10.5pt; font-weight: 700; color: #0f4c81;
    border-left: 4px solid #0f4c81; padding-left: 8px; margin: 0 0 8px;
  }
  .info-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px;
    border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 12px; background: #f8fafc;
  }
  .info-item { display: flex; gap: 6px; font-size: 10pt; }
  .info-label { flex: 0 0 96px; color: #64748b; }
  .info-value { flex: 1; color: #0f172a; font-weight: 500; word-break: break-word; }
  .info-item.full { grid-column: 1 / -1; }
  .text-block {
    border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 12px;
    background: #fff; white-space: pre-wrap; word-break: break-word; min-height: 48px;
  }
  table.data-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  table.data-table th {
    background: #0f4c81; color: #fff; font-weight: 600;
    padding: 7px 8px; text-align: left; border: 1px solid #0f4c81;
  }
  table.data-table td {
    padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top;
  }
  table.data-table tbody tr:nth-child(even) td { background: #f8fafc; }
  .totals { margin-top: 8px; text-align: right; font-size: 10.5pt; }
  .totals strong { color: #0f4c81; }
  .sign-row {
    margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;
    font-size: 10pt; color: #334155;
  }
  .sign-row.cols-2 { grid-template-columns: 1fr 1fr; }
  .sign-box { border-top: 1px solid #94a3b8; padding-top: 6px; min-height: 36px; }
  .report-footer {
    margin-top: 18px; padding-top: 8px; border-top: 1px dashed #cbd5e1;
    font-size: 8.5pt; color: #94a3b8; text-align: center;
  }
</style>
"""

PRINT_STYLE_A5 = """
<style>
  @page { size: A5 portrait; margin: 10mm 8mm 12mm 8mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0; padding: 0;
    font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
    font-size: 10pt; line-height: 1.5; color: #1e293b;
  }
  .cert {
    max-width: 128mm; margin: 0 auto;
    border: 2px solid #0f4c81; border-radius: 6px; padding: 14px 16px;
  }
  .cert-title {
    text-align: center; font-size: 18pt; font-weight: 700; color: #0f4c81;
    letter-spacing: 4px; margin: 0 0 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;
  }
  .cert-no { text-align: center; font-size: 9pt; color: #64748b; margin-bottom: 12px; }
  .cert-grid { display: grid; grid-template-columns: 88px 1fr; gap: 4px 8px; font-size: 9.5pt; }
  .cert-label { color: #64748b; }
  .cert-value { color: #0f172a; font-weight: 500; word-break: break-word; }
  .cert-result {
    margin: 12px 0; text-align: center; font-size: 12pt; font-weight: 700; color: #166534;
    border: 1px dashed #86efac; background: #f0fdf4; padding: 8px; border-radius: 4px;
  }
  .cert-sign {
    margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 9pt;
  }
  .cert-sign-box { border-top: 1px solid #94a3b8; padding-top: 4px; min-height: 28px; }
</style>
"""


def _info_items_html(items: list[tuple[str, str]]) -> str:
    rows = []
    for label, expr in items:
        full = ' full' if label in ("备注", "合同条款", "收货地址") else ""
        rows.append(
            f'      <div class="info-item{full}"><span class="info-label">{label}</span>'
            f'<span class="info-value">{{{{ {expr} or "—" }}}}</span></div>'
        )
    return "\n".join(rows)


def build_a4_document(
    *,
    title: str,
    info_items: list[tuple[str, str]],
    table_head: str,
    table_row: str,
    totals_html: str = "",
    extra_sections: str = "",
    sign_labels: tuple[str, ...] = ("制单人", "审核人", "签收人"),
    notes_expr: str = "notes",
) -> str:
    signs = "".join(f'<div class="sign-box">{label}：</div>' for label in sign_labels)
    cols_class = " cols-2" if len(sign_labels) == 2 else ""
    notes_block = ""
    if notes_expr:
        notes_block = f"""
  <div class="section">
    <div class="section-title">备注</div>
    <div class="text-block">{{{{ {notes_expr} or "—" }}}}</div>
  </div>"""
    return (
        PRINT_STYLE_A4
        + f"""
<div class="report">
  <div class="report-header">
    <div><h1 class="report-title">{title}</h1></div>
    <div class="doc-meta">
      <strong>{{{{ code or "—" }}}}</strong>
      打印时间：{{{{ print_time or "—" }}}}
    </div>
  </div>

  <div class="section">
    <div class="section-title">基本信息</div>
    <div class="info-grid">
{_info_items_html(info_items)}
    </div>
  </div>
{extra_sections}
  <div class="section">
    <div class="section-title">明细</div>
    <table class="data-table">
      <thead><tr>{table_head}</tr></thead>
      <tbody>
        {{% for item in items %}}
        <tr>{table_row}</tr>
        {{% endfor %}}
      </tbody>
    </table>
    {totals_html}
  </div>
{notes_block}
  <div class="sign-row{cols_class}">
    {signs}
  </div>
  <div class="report-footer">本单据由系统自动生成，盖章有效</div>
</div>
"""
    )


def build_certificate_document() -> str:
    return (
        PRINT_STYLE_A5
        + """
<div class="cert">
  <h1 class="cert-title">产品合格证</h1>
  <p class="cert-no">证书编号：{{ release_certificate or "—" }}</p>
  <div class="cert-grid">
    <span class="cert-label">产品名称</span><span class="cert-value">{{ material_name or "—" }}</span>
    <span class="cert-label">规格型号</span><span class="cert-value">{{ material_spec or "—" }}</span>
    <span class="cert-label">产品编号</span><span class="cert-value">{{ material_code or "—" }}</span>
    <span class="cert-label">生产批次</span><span class="cert-value">{{ batch_number or "—" }}</span>
    <span class="cert-label">检验数量</span><span class="cert-value">{{ inspection_quantity | number }}</span>
    <span class="cert-label">合格数量</span><span class="cert-value">{{ qualified_quantity | number }}</span>
    <span class="cert-label">工单编号</span><span class="cert-value">{{ work_order_code or "—" }}</span>
    <span class="cert-label">销售订单</span><span class="cert-value">{{ sales_order_code or "—" }}</span>
    <span class="cert-label">客户名称</span><span class="cert-value">{{ customer_name or "—" }}</span>
    <span class="cert-label">检验日期</span><span class="cert-value">{{ inspection_time | date }}</span>
    <span class="cert-label">检验员</span><span class="cert-value">{{ inspector_name or "—" }}</span>
  </div>
  <div class="cert-result">检验结论：{{ quality_status or inspection_result or "合格" }}</div>
  <div class="cert-sign">
    <div class="cert-sign-box">检验员（签章）</div>
    <div class="cert-sign-box">质量部门（签章）</div>
  </div>
</div>
"""
    )


def make_preset(
    *,
    name: str,
    code: str,
    document_type: str,
    content: str | None = None,
    page_size: str = "A4",
    description: str | None = None,
) -> dict:
    from apps.kuaizhizao.print.designer_presets import (
        build_designer_schema_for_document_type,
        compile_designer_schema,
    )

    designer_schema = build_designer_schema_for_document_type(document_type)
    if page_size == "A5":
        designer_schema = {**designer_schema, "pageSize": "A5"}
    compiled_content = compile_designer_schema(designer_schema)
    return {
        "name": name,
        "code": code,
        "type": "html",
        "description": description or f"快制造预置打印模板：{name}",
        "content": compiled_content or content or "",
        "config": {
            "document_type": document_type,
            "engine": "jinja2",
            "strict_variables": False,
            "source_type": "designer_json",
            "designer_version": "v1",
            "designer_schema": designer_schema,
            "page": {"size": page_size, "orientation": "portrait", "margin": "14mm 12mm"},
        },
        "is_active": True,
        "is_default": True,
    }
