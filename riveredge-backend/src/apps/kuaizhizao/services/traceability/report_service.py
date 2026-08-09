"""
追溯报告 PDF 生成（GB/T 章节结构）
"""

import html
from datetime import datetime
from typing import Optional, Tuple
from uuid import uuid4

from apps.kuaizhizao.schemas.traceability_schemas import TraceDirection, TraceProfileResponse
from apps.kuaizhizao.services.print_service import _html_to_pdf_bytes
from core.utils.timezone_utils import resolve_business_datetime, today_site_str


_BIZ_STEP_ZH = {
    "receiving": "收货入库",
    "commissioning": "投产",
    "inspecting": "检验",
    "picking": "投料",
    "shipping": "销售出库",
    "accepting": "退货入库",
    "transforming": "生产转换",
    "storing": "入库",
    "decommissioning": "出库",
    "other": "其他",
}

_DOC_TYPE_ZH = {
    "serial": "序列号",
    "batch": "批号",
    "work_order": "工单",
    "purchase_receipt": "采购入库",
    "customer_material_registration": "代工来料",
    "finished_goods_receipt": "成品入库",
    "semi_finished_goods_receipt": "半成品入库",
    "sales_delivery": "销售出库",
    "sales_return": "销售退货",
    "incoming_inspection": "来料检验",
    "process_inspection": "过程检验",
    "finished_goods_inspection": "成品检验",
    "oqc_inspection": "出货检验",
    "defect_record": "不合格品",
    "material_binding": "物料绑定",
    "production_picking": "生产领料",
    "reporting_record": "报工记录",
}


class TraceReportService:
    @staticmethod
    def _format_dt(value: Optional[datetime]) -> str:
        if not value:
            return "-"
        return value.strftime("%Y-%m-%d %H:%M:%S")

    @staticmethod
    def render_html(
        profile: TraceProfileResponse,
        *,
        company_name: str,
        generated_by: Optional[str] = None,
    ) -> str:
        anchor = profile.anchor
        report_no = f"TR-{today_site_str()}-{uuid4().hex[:8].upper()}"
        generated_at = resolve_business_datetime().strftime("%Y-%m-%d %H:%M:%S")
        direction_zh = {"forward": "正向", "backward": "反向", "both": "双向"}.get(
            profile.summary.direction, profile.summary.direction
        )

        event_rows = ""
        for ev in profile.events:
            if ev.document_type in ("serial", "batch") and ev.document_code == anchor.code:
                continue
            event_rows += f"""
            <tr>
              <td>{html.escape(TraceReportService._format_dt(ev.event_time))}</td>
              <td>{html.escape(_BIZ_STEP_ZH.get(ev.biz_step.value, ev.biz_step.value))}</td>
              <td>{html.escape(_DOC_TYPE_ZH.get(ev.document_type, ev.document_type))}</td>
              <td>{html.escape(ev.document_code or '-')}</td>
              <td>{html.escape(ev.material_code or '-')}</td>
              <td>{html.escape(ev.material_name or '-')}</td>
              <td>{html.escape(str(ev.quantity) if ev.quantity is not None else '-')}</td>
              <td>{html.escape(ev.operator or '-')}</td>
              <td>{html.escape(ev.quality_status or ev.remark or '-')}</td>
            </tr>"""

        edge_rows = ""
        for edge in profile.edges:
            edge_rows += f"""
            <tr>
              <td>{html.escape(edge.source)}</td>
              <td>{html.escape(edge.label or '-')}</td>
              <td>{html.escape(edge.target)}</td>
            </tr>"""

        production_events = [
            e for e in profile.events
            if e.document_type in (
                "work_order",
                "material_binding",
                "reporting_record",
                "production_picking",
            )
        ]
        quality_events = [
            e for e in profile.events
            if "inspection" in e.document_type or e.document_type == "defect_record"
        ]
        logistics_events = [
            e for e in profile.events
            if e.document_type in (
                "purchase_receipt",
                "customer_material_registration",
                "finished_goods_receipt",
                "semi_finished_goods_receipt",
                "sales_delivery",
                "sales_return",
                "production_picking",
            )
        ]

        def section_table(events, title: str) -> str:
            if not events:
                return f"<h2>{html.escape(title)}</h2><p>无相关记录</p>"
            rows = ""
            for ev in events:
                rows += f"""<tr>
                  <td>{html.escape(TraceReportService._format_dt(ev.event_time))}</td>
                  <td>{html.escape(_DOC_TYPE_ZH.get(ev.document_type, ev.document_type))}</td>
                  <td>{html.escape(ev.document_code)}</td>
                  <td>{html.escape(ev.material_name or '-')}</td>
                  <td>{html.escape(str(ev.quantity) if ev.quantity is not None else '-')}</td>
                  <td>{html.escape(ev.quality_status or ev.remark or '-')}</td>
                </tr>"""
            return f"""
            <h2>{html.escape(title)}</h2>
            <table>
              <thead><tr>
                <th>时间</th><th>类型</th><th>单号</th><th>物料</th><th>数量</th><th>备注</th>
              </tr></thead>
              <tbody>{rows}</tbody>
            </table>"""

        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>产品追溯报告</title>
<style>
  body {{ font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 12px; color: #222; margin: 24px; }}
  h1 {{ text-align: center; font-size: 20px; margin-bottom: 8px; }}
  h2 {{ font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }}
  .meta {{ margin: 12px 0 20px; }}
  .meta table {{ width: 100%; border-collapse: collapse; }}
  .meta td {{ padding: 4px 8px; border: 1px solid #ddd; }}
  .meta td.label {{ width: 120px; background: #f5f5f5; font-weight: bold; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 8px; }}
  th, td {{ border: 1px solid #ddd; padding: 4px 6px; text-align: left; word-break: break-all; }}
  th {{ background: #f0f0f0; }}
  .footer {{ margin-top: 24px; font-size: 11px; color: #666; }}
</style>
</head>
<body>
  <h1>产品追溯报告</h1>
  <div class="meta">
    <table>
      <tr><td class="label">企业名称</td><td>{html.escape(company_name)}</td>
          <td class="label">报告编号</td><td>{html.escape(report_no)}</td></tr>
      <tr><td class="label">追溯码</td><td>{html.escape(anchor.code)}</td>
          <td class="label">追溯类型</td><td>{html.escape(anchor.identifier_type.value)}</td></tr>
      <tr><td class="label">物料编码</td><td>{html.escape(anchor.material_code or '-')}</td>
          <td class="label">物料名称</td><td>{html.escape(anchor.material_name or '-')}</td></tr>
      <tr><td class="label">物料型号</td><td>{html.escape(anchor.material_model or '-')}</td>
          <td class="label">入库日期</td><td>{html.escape(str(anchor.inbound_date) if anchor.inbound_date else '-')}</td></tr>
      <tr><td class="label">当前状态</td><td>{html.escape(anchor.status or '-')}</td>
          <td class="label">追溯方向</td><td>{html.escape(direction_zh)}</td></tr>
      <tr><td class="label">生成时间</td><td>{html.escape(generated_at)}</td>
          <td class="label">生成人</td><td>{html.escape(generated_by or '-')}</td></tr>
    </table>
  </div>

  <h2>1. 追溯摘要</h2>
  <p>共 {profile.summary.event_count} 条事件、{profile.summary.node_count} 个节点、{profile.summary.edge_count} 条关系；
  时间范围：{html.escape(TraceReportService._format_dt(profile.summary.time_from))}
  至 {html.escape(TraceReportService._format_dt(profile.summary.time_to))}。</p>

  <h2>2. 追溯单元</h2>
  <p>追溯码 <strong>{html.escape(anchor.code)}</strong>，
  物料 {html.escape(anchor.material_code or '-')} / {html.escape(anchor.material_name or '-')}，
  状态 {html.escape(anchor.status or '-')}。</p>

  <h2>3. 事件时间线</h2>
  <table>
    <thead><tr>
      <th>时间</th><th>环节</th><th>单据类型</th><th>单号</th>
      <th>物料编码</th><th>物料名称</th><th>数量</th><th>操作人</th><th>质量/备注</th>
    </tr></thead>
    <tbody>{event_rows or '<tr><td colspan="9">无事件记录</td></tr>'}</tbody>
  </table>

  {section_table(production_events, "4. 生产制造")}
  {section_table(quality_events, "5. 质量检验")}
  {section_table(logistics_events, "6. 仓储物流")}

  <h2>7. 追溯关系</h2>
  <table>
    <thead><tr><th>来源节点</th><th>关系</th><th>目标节点</th></tr></thead>
    <tbody>{edge_rows or '<tr><td colspan="3">无关系边</td></tr>'}</tbody>
  </table>

  <div class="footer">
    本报告数据均来自系统已确认业务单据，不含推断信息。RiverEdge 追溯管理系统。
  </div>
</body>
</html>"""

    @staticmethod
    async def generate_pdf(
        profile: TraceProfileResponse,
        *,
        tenant_id: int,
        company_name: str,
        generated_by: Optional[str] = None,
    ) -> Tuple[bytes, str]:
        html_content = TraceReportService.render_html(
            profile,
            company_name=company_name,
            generated_by=generated_by,
        )
        pdf_bytes, _ = await _html_to_pdf_bytes(html_content, tenant_id=tenant_id)
        safe_code = profile.anchor.code.replace("/", "-").replace("\\", "-")[:80]
        filename = f"追溯报告_{safe_code}_{today_site_str()}.pdf"
        return pdf_bytes, filename
