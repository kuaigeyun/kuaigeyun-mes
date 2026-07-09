"""好力 GO — 维保/维修完成单打印。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from loguru import logger

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.api.routes_equipment_documents import _serialize_spot_check
from apps.haoligo.api.routes_equipment_upkeep_complete_sheet import _serialize as serialize_equipment_upkeep_complete
from apps.haoligo.api.routes_mold_maintenance_complete_sheet import _serialize as serialize_mold_maintenance_complete
from apps.haoligo.api.routes_mold_outsource_maintenance_complete_sheet import (
    _serialize as serialize_mold_outsource_complete,
)
from apps.haoligo.models.equipment_operations import HaoligoEquipmentSpotCheck
from apps.haoligo.models.equipment_upkeep import HaoligoEquipmentUpkeepCompleteSheet
from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.kuaizhizao.services.print_service import (
    DocumentPrintService,
    _resolve_company_logo_for_print,
)
from core.models.print_template import PrintTemplate
from core.schemas.print_template import PrintTemplateRenderRequest
from core.services.print.print_template_service import PrintTemplateService
from core.services.print.template_renderer import is_pdfme_template
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.tenant import Tenant


SUPPORTED_DOCUMENT_TYPES = frozenset(
    {
        "equipment_spot_check",
        "equipment_upkeep_complete",
        "mold_maintenance_complete",
        "mold_outsource_maintenance_complete",
        "finance_material_acceptance",
    }
)

DOCUMENT_TEMPLATE_CODES = {
    "equipment_spot_check": "HAOLIGO_EQUIPMENT_SPOT_CHECK_PRINT",
    "equipment_upkeep_complete": "HAOLIGO_EQUIPMENT_UPKEEP_COMPLETE_PRINT",
    "mold_maintenance_complete": "HAOLIGO_MOLD_MAINTENANCE_COMPLETE_PRINT",
    "mold_outsource_maintenance_complete": "HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE_PRINT",
    "finance_material_acceptance": "HAOLIGO_FINANCE_MATERIAL_ACCEPTANCE_PRINT",
}


def _file_download_path(file_uuid: str, *, size: int = 320) -> str:
    u = (file_uuid or "").strip()
    if not u:
        return ""
    return f"/api/v1/core/files/{u}/download?size={size}"


def _photo_items(uuids: Optional[List[str]]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for raw in uuids or []:
        url = _file_download_path(str(raw).strip())
        if url:
            out.append({"image_url": url})
    return out


def _fmt_dt(v: Any) -> str:
    if v is None:
        return "—"
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M")
    s = str(v).strip()
    return s[:16].replace("T", " ") if s else "—"


def _yes_no_label(flag: bool) -> str:
    return "是" if flag else "否"


_SPOT_CHECK_RESULT_LABELS = {"normal": "正常", "abnormal": "异常"}


def _spot_check_numeric_range_label(
    *,
    numeric_min: Any,
    numeric_max: Any,
    unit: Optional[str],
) -> str:
    u = (unit or "").strip()
    suffix = f" {u}" if u else ""
    if numeric_min is not None and numeric_max is not None:
        return f"标准 {numeric_min}～{numeric_max}{suffix}"
    if numeric_min is not None:
        return f"≥ {numeric_min}{suffix}"
    if numeric_max is not None:
        return f"≤ {numeric_max}{suffix}"
    return ""


def _upkeep_line_summary(line: Any) -> str:
    content = (getattr(line, "upkeep_content", None) or "").strip()
    if content:
        return content
    rows = getattr(line, "upkeep_record_lines", None) or []
    parts: List[str] = []
    for rec in rows:
        name = (getattr(rec, "param_name", None) or "").strip()
        val = (getattr(rec, "record_value", None) or "").strip()
        if name and val:
            parts.append(f"{name}: {val}")
        elif name:
            parts.append(name)
    return "；".join(parts) if parts else "—"


async def _tenant_display_name(tenant_id: int) -> str:
    # infra.models.tenant.Tenant 无 deleted_at（非软删表）
    row = await Tenant.filter(id=tenant_id).first()
    if not row:
        return ""
    return (getattr(row, "name", None) or "").strip()


class HaoligoDocumentPrintService:
    """维保完成单打印（复用核心模板渲染与 PDF 输出）。"""

    _finalize = DocumentPrintService()._finalize_print_payload

    async def get_document_variables_for_print(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        *,
        print_user: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await self._get_document_data(
            tenant_id,
            document_type,
            document_id,
            print_user=print_user,
        )

    async def print_document(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        *,
        template_code: Optional[str] = None,
        template_uuid: Optional[str] = None,
        output_format: str = "html",
        print_user: Optional[str] = None,
    ) -> Dict[str, Any]:
        if document_type not in SUPPORTED_DOCUMENT_TYPES:
            raise ValidationError(f"不支持的单据类型: {document_type}")

        document_data = await self._get_document_data(
            tenant_id,
            document_type,
            document_id,
            print_user=print_user,
        )
        if not document_data.get("company_logo"):
            document_data["company_logo"] = await _resolve_company_logo_for_print(tenant_id)
        if not document_data.get("logo") and document_data.get("company_logo"):
            document_data["logo"] = document_data["company_logo"]

        if template_uuid:
            template = await PrintTemplate.filter(
                tenant_id=tenant_id,
                uuid=template_uuid,
                is_active=True,
                deleted_at__isnull=True,
            ).first()
        else:
            code = template_code or DOCUMENT_TEMPLATE_CODES.get(document_type)
            if not code:
                raise ValidationError(f"未配置单据类型 {document_type} 的默认打印模板")
            template = await PrintTemplate.filter(
                tenant_id=tenant_id,
                code=code,
                is_active=True,
                deleted_at__isnull=True,
            ).first()

        if not template:
            raise NotFoundError(
                f"未找到打印模板，请先在「系统 → 打印模板」加载好力 GO 预设或新建模板（{DOCUMENT_TEMPLATE_CODES.get(document_type)}）"
            )

        code_used = template_code or getattr(template, "code", None)

        if is_pdfme_template(template.content or ""):
            raise ValidationError("该业务仅支持 HTML/Jinja2 打印模板，请在打印模板中选用好力 GO 维保完成报告预设")

        render_result = await PrintTemplateService.render_print_template(
            tenant_id=tenant_id,
            uuid=str(template.uuid),
            data=PrintTemplateRenderRequest(
                data=document_data,
                output_format="html",
                async_execution=False,
            ),
        )

        return await self._finalize(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
            template_code=code_used,
            html_content=render_result.get("content", ""),
            output_format=output_format,
            message="打印成功",
        )

    async def _get_document_data(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        *,
        print_user: Optional[str] = None,
    ) -> Dict[str, Any]:
        if document_type == "equipment_spot_check":
            return await self._format_equipment_spot_check(tenant_id, document_id, print_user=print_user)
        if document_type == "equipment_upkeep_complete":
            return await self._format_equipment_upkeep_complete(tenant_id, document_id, print_user=print_user)
        if document_type == "mold_maintenance_complete":
            return await self._format_mold_maintenance_complete(tenant_id, document_id, print_user=print_user)
        if document_type == "mold_outsource_maintenance_complete":
            return await self._format_mold_outsource_complete(tenant_id, document_id, print_user=print_user)
        if document_type == "finance_material_acceptance":
            return await self._format_finance_material_acceptance(tenant_id, document_id, print_user=print_user)
        raise ValidationError(f"不支持的单据类型: {document_type}")

    async def _format_equipment_spot_check(
        self,
        tenant_id: int,
        document_id: int,
        *,
        print_user: Optional[str] = None,
    ) -> Dict[str, Any]:
        from apps.haoligo.services.equipment_operational_status import format_operational_status_label

        row = await tenant_alive(HaoligoEquipmentSpotCheck, tenant_id).filter(id=document_id).first()
        if not row:
            raise NotFoundError("设备点检单不存在")
        out = await _serialize_spot_check(row, with_lines=True)
        company_name = await _tenant_display_name(tenant_id)
        set_label = ""
        if out.inspection_param_set_code or out.inspection_param_set_name:
            set_label = f"{out.inspection_param_set_code or ''} {out.inspection_param_set_name or ''}".strip()

        line_items: List[Dict[str, Any]] = []
        abnormal_count = 0
        for ln in out.lines:
            if (ln.result or "").strip().lower() == "abnormal":
                abnormal_count += 1
            result_key = (ln.result or "").strip().lower()
            line_items.append(
                {
                    "param_code": ln.param_code or "",
                    "param_name": ln.param_name or "",
                    "param_requirement": ln.param_requirement or "",
                    "measured_value": ln.measured_value or "",
                    "unit": ln.unit or "",
                    "result": result_key,
                    "result_label": _SPOT_CHECK_RESULT_LABELS.get(result_key, ln.result or "—"),
                    "remark": ln.remark or "",
                    "numeric_range": _spot_check_numeric_range_label(
                        numeric_min=ln.numeric_min,
                        numeric_max=ln.numeric_max,
                        unit=ln.unit,
                    ),
                }
            )

        return {
            "document_id": out.id,
            "document_type": "equipment_spot_check",
            "report_title": "设备点检报告",
            "sheet_no": out.sheet_no or "",
            "recorded_at": _fmt_dt(out.recorded_at),
            "equipment_asset_code": out.equipment_asset_code or "",
            "equipment_name": out.equipment_name or "",
            "inspection_param_set_label": set_label,
            "abnormal_description": out.abnormal_description or "",
            "applied_operational_status_label": await format_operational_status_label(
                tenant_id, out.applied_operational_status
            ),
            "report_enabled_label": _yes_no_label(bool(out.report_enabled)),
            "line_count": len(line_items),
            "abnormal_count": abnormal_count,
            "line_items": line_items,
            "created_at": _fmt_dt(out.created_at),
            "print_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "print_user": (print_user or "").strip(),
            "company_name": company_name,
        }

    async def _format_equipment_upkeep_complete(
        self,
        tenant_id: int,
        document_id: int,
        *,
        print_user: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id).filter(id=document_id).first()
        if not row:
            raise NotFoundError("设备维保完成单不存在")
        out = await serialize_equipment_upkeep_complete(row)
        svc = (out.service_type or "保养").strip()
        company_name = await _tenant_display_name(tenant_id)
        title = "设备维修完成报告" if svc == "维修" else "设备保养完成报告"
        return {
            "document_id": out.id,
            "document_type": "equipment_upkeep_complete",
            "report_title": title,
            "sheet_no": out.sheet_no or "",
            "service_type": svc,
            "source_order_no": out.source_order_no,
            "equipment_asset_code": out.equipment_asset_code or "",
            "equipment_name": out.equipment_name or "",
            "applicant_name": out.applicant_name or "",
            "department_name": out.department_name or "",
            "source_description": out.source_description or "",
            "completion_content": out.completion_content or "",
            "repair_content": out.repair_content or "",
            "repair_result": out.repair_result or "",
            "clear_total_production_label": _yes_no_label(bool(out.clear_total_production)),
            "created_at": _fmt_dt(out.created_at),
            "print_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "print_user": (print_user or "").strip(),
            "company_name": company_name,
            "before_photos": _photo_items(out.source_header_attachment_file_uuids),
            "after_photos": _photo_items(out.header_attachment_file_uuids),
            "is_outsource": False,
        }

    async def _format_mold_maintenance_complete(
        self,
        tenant_id: int,
        document_id: int,
        *,
        print_user: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = await tenant_alive(HaoligoMoldMaintenanceCompleteSheet, tenant_id).filter(id=document_id).first()
        if not row:
            raise NotFoundError("模具维保完修单不存在")
        out = await serialize_mold_maintenance_complete(row)
        return await self._mold_sheet_print_payload(
            tenant_id,
            out,
            document_type="mold_maintenance_complete",
            print_user=print_user,
            is_outsource=False,
        )

    async def _format_mold_outsource_complete(
        self,
        tenant_id: int,
        document_id: int,
        *,
        print_user: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = await tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(id=document_id).first()
        if not row:
            raise NotFoundError("外协维保完修单不存在")
        out = await serialize_mold_outsource_complete(row)
        return await self._mold_sheet_print_payload(
            tenant_id,
            out,
            document_type="mold_outsource_maintenance_complete",
            print_user=print_user,
            is_outsource=True,
        )

    async def _mold_sheet_print_payload(
        self,
        tenant_id: int,
        out: Any,
        *,
        document_type: str,
        print_user: Optional[str],
        is_outsource: bool,
    ) -> Dict[str, Any]:
        svc = (getattr(out, "service_type", None) or "维修").strip()
        company_name = await _tenant_display_name(tenant_id)
        if is_outsource:
            title = "模具外协维修完成报告"
        elif svc == "维修":
            title = "模具维修完成报告"
        else:
            title = "模具保养完成报告"

        line_items: List[Dict[str, Any]] = []
        for ln in getattr(out, "line_items", None) or []:
            rec_rows = []
            for rec in getattr(ln, "upkeep_record_lines", None) or []:
                rec_rows.append(
                    {
                        "param_code": getattr(rec, "param_code", "") or "",
                        "param_name": getattr(rec, "param_name", "") or "",
                        "requirement": getattr(rec, "requirement", None) or "",
                        "record_value": getattr(rec, "record_value", None) or "",
                    }
                )
            cost = getattr(ln, "repair_cost", None)
            line_items.append(
                {
                    "mold_code": getattr(ln, "mold_code", "") or "",
                    "mold_name": getattr(ln, "mold_name", None) or "",
                    "repair_reason": getattr(ln, "repair_reason", None) or "",
                    "repair_content": getattr(ln, "repair_content", None) or "",
                    "repair_result": getattr(ln, "repair_result", None) or "",
                    "repair_cost": str(cost) if cost is not None else "",
                    "upkeep_summary": _upkeep_line_summary(ln),
                    "clear_total_production_label": _yes_no_label(bool(getattr(ln, "clear_total_production", False))),
                    "upkeep_record_lines": rec_rows,
                }
            )

        return {
            "document_id": out.id,
            "document_type": document_type,
            "report_title": title,
            "sheet_no": getattr(out, "sheet_no", None) or "",
            "service_type": svc,
            "source_order_no": getattr(out, "source_order_no", "") or "",
            "applicant_name": getattr(out, "applicant_name", None) or "",
            "department_name": getattr(out, "department_name", None) or "",
            "clear_total_production_label": _yes_no_label(bool(getattr(out, "clear_total_production", False))),
            "outsourced_unit_name": getattr(out, "outsourced_unit_name", None) or "",
            "sheet_status": getattr(out, "sheet_status", None) or "",
            "created_at": _fmt_dt(getattr(out, "created_at", None)),
            "print_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "print_user": (print_user or "").strip(),
            "company_name": company_name,
            "line_items": line_items,
            "before_photos": _photo_items(getattr(out, "source_header_attachment_file_uuids", None)),
            "after_photos": _photo_items(getattr(out, "header_attachment_file_uuids", None)),
            "is_outsource": is_outsource,
        }

    async def _format_finance_material_acceptance(
        self,
        tenant_id: int,
        document_id: int,
        *,
        print_user: Optional[str] = None,
    ) -> Dict[str, Any]:
        from decimal import Decimal

        from apps.haoligo.constants.finance_print import (
            HAOLIGO_FINANCE_ACCEPTANCE_PRINT_LINES_PER_PAGE,
            HAOLIGO_FINANCE_PRINT_COMPANY_ADDRESS,
            HAOLIGO_FINANCE_PRINT_COMPANY_NAME,
        )
        from apps.haoligo.models.finance_invoice import (
            HaoligoFinanceAcceptanceInvoice,
            HaoligoFinanceMaterialAcceptance,
            HaoligoFinanceMaterialAcceptanceLine,
        )
        from apps.haoligo.services.finance_supplier_price import get_supplier_or_404
        from apps.haoligo.utils.amount_uppercase_cn import amount_to_cn_uppercase

        row = await tenant_alive(HaoligoFinanceMaterialAcceptance, tenant_id).filter(id=document_id).first()
        if not row:
            raise NotFoundError("材料验收单不存在")
        supplier = await get_supplier_or_404(tenant_id, row.supplier_id)
        line_rows = await HaoligoFinanceMaterialAcceptanceLine.filter(
            tenant_id=tenant_id, acceptance_id=row.id, deleted_at__isnull=True
        ).order_by("line_no", "id")
        links = await HaoligoFinanceAcceptanceInvoice.filter(
            tenant_id=tenant_id, acceptance_id=row.id, deleted_at__isnull=True
        ).prefetch_related("invoice")
        invoice_nos: list[str] = []
        for lk in links:
            inv = getattr(lk, "invoice", None)
            if inv and inv.invoice_no and inv.invoice_no not in invoice_nos:
                invoice_nos.append(inv.invoice_no)

        def _fmt_qty(v: Any) -> str:
            d = Decimal(str(v or 0))
            s = format(d.normalize(), "f")
            return s.rstrip("0").rstrip(".") if "." in s else s

        def _fmt_money(v: Any) -> str:
            return format(Decimal(str(v or 0)).quantize(Decimal("0.01")), "f")

        def _fmt_unit_price(v: Any) -> str:
            d = Decimal(str(v or 0))
            s = format(d.normalize(), "f")
            return s.rstrip("0").rstrip(".") if "." in s else s

        all_lines: List[Dict[str, Any]] = []
        for ln in line_rows:
            spec = (ln.spec or "").strip()
            name = (ln.material_name or "").strip()
            product = f"{name} {spec}".strip() if spec else name
            all_lines.append(
                {
                    "line_no": ln.line_no,
                    # 打印模板物料编码列留空（与客户纸质验收单习惯一致）
                    "material_code": "",
                    "product_name_spec": product,
                    "quantity_display": _fmt_qty(ln.quantity),
                    "unit": ln.unit or "",
                    "unit_price_display": _fmt_unit_price(ln.unit_price),
                    "amount_display": _fmt_money(ln.amount),
                    "remark": "",
                }
            )

        per_page = HAOLIGO_FINANCE_ACCEPTANCE_PRINT_LINES_PER_PAGE
        if not all_lines:
            chunks: List[List[Dict[str, Any]]] = [[]]
        else:
            chunks = [all_lines[i : i + per_page] for i in range(0, len(all_lines), per_page)]

        empty_line = {
            "line_no": "",
            "material_code": "",
            "product_name_spec": "",
            "quantity_display": "",
            "unit": "",
            "unit_price_display": "",
            "amount_display": "",
            "remark": "",
        }
        line_pages: List[Dict[str, Any]] = []
        for chunk in chunks:
            padded = list(chunk)
            while len(padded) < per_page:
                padded.append(dict(empty_line))
            line_pages.append({"line_items": padded})

        # 兼容旧模板变量：首页明细
        line_items = line_pages[0]["line_items"] if line_pages else []

        total = Decimal(str(row.total_amount or 0))
        sheet_date = row.acceptance_date.isoformat() if row.acceptance_date else _fmt_dt(row.created_at)[:10]
        tenant_name = await _tenant_display_name(tenant_id)

        return {
            "document_id": row.id,
            "document_type": "finance_material_acceptance",
            "company_name": HAOLIGO_FINANCE_PRINT_COMPANY_NAME or tenant_name,
            "company_address": HAOLIGO_FINANCE_PRINT_COMPANY_ADDRESS,
            "invoice_nos": "-".join(invoice_nos) if invoice_nos else "",
            "preparer_name": (print_user or "").strip(),
            "verifier_name": (print_user or "").strip(),
            "supplier_name": supplier.supplier_name,
            "supplier_code": supplier.supplier_code,
            "sheet_no": row.sheet_no,
            "sheet_date": sheet_date,
            "total_amount": float(total),
            "total_amount_display": _fmt_money(total),
            "total_amount_uppercase": amount_to_cn_uppercase(total),
            "remark": (row.remark or "").strip(),
            "line_items": line_items,
            "line_pages": line_pages,
            "line_count": len(all_lines),
            "print_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "print_user": (print_user or "").strip(),
        }
