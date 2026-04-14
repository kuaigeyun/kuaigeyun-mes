"""
单据打印服务模块

提供业务单据的打印功能，支持使用打印模板渲染单据。

Author: Luigi Lu
Date: 2025-01-01
"""

import base64
import os
from io import BytesIO
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
from loguru import logger

from core.services.print.print_template_service import PrintTemplateService
from core.schemas.print_template import PrintTemplateRenderRequest
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from apps.kuaizhizao.services.document_lifecycle_service import _is_approved

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.production_return_item import ProductionReturnItem
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.finished_goods_receipt_item import FinishedGoodsReceiptItem
from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
from apps.kuaizhizao.models.semi_finished_goods_receipt_item import SemiFinishedGoodsReceiptItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.kuaizhizao.models.sales_forecast import SalesForecast
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.other_inbound import OtherInbound
from apps.kuaizhizao.models.other_inbound_item import OtherInboundItem
from apps.kuaizhizao.models.other_outbound import OtherOutbound
from apps.kuaizhizao.models.other_outbound_item import OtherOutboundItem
from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.quotation_item import QuotationItem
from apps.master_data.models.material import Material
from core.services.file.file_preview_service import FilePreviewService
from core.services.file.file_service import FileService
from apps.kuaizhizao.models.material_borrow import MaterialBorrow
from apps.kuaizhizao.models.material_borrow_item import MaterialBorrowItem
from apps.kuaizhizao.models.material_return import MaterialReturn
from apps.kuaizhizao.models.material_return_item import MaterialReturnItem


def _html_to_pdf_engine_pref() -> str:
    """环境变量 RIVEREDGE_HTML_TO_PDF_ENGINE：auto | weasyprint | xhtml2pdf"""
    return os.environ.get("RIVEREDGE_HTML_TO_PDF_ENGINE", "auto").strip().lower()


def _html_to_pdf_bytes_xhtml2pdf(html_string: str) -> bytes:
    from xhtml2pdf import pisa

    from core.services.print.pdf_cjk_font import ensure_reportlab_cjk_font, inject_cjk_font_css

    font_name = ensure_reportlab_cjk_font()
    html_for_pisa = inject_cjk_font_css(html_string, font_name)
    out = BytesIO()
    status = pisa.CreatePDF(html_for_pisa, dest=out, encoding="utf-8")
    if status.err:
        raise RuntimeError(f"xhtml2pdf 渲染错误计数: {status.err}")
    pdf_bytes = out.getvalue()
    if not pdf_bytes:
        raise RuntimeError("xhtml2pdf 产出为空")
    return pdf_bytes


def _html_to_pdf_bytes_weasyprint(html_string: str) -> bytes:
    from weasyprint import HTML

    return HTML(string=html_string, base_url="/").write_pdf()


def _html_to_pdf_bytes(html_string: str) -> bytes:
    """
    将完整 HTML 转为 PDF。
    - auto：优先 WeasyPrint，失败则 xhtml2pdf
    - weasyprint：仅 WeasyPrint（生产可配合 Linux + GTK 固定版式）
    - xhtml2pdf：仅 xhtml2pdf（免 GTK，版式可能与 WeasyPrint 不同）
    """
    pref = _html_to_pdf_engine_pref()
    weasy_err: Optional[BaseException] = None

    if pref == "xhtml2pdf":
        try:
            return _html_to_pdf_bytes_xhtml2pdf(html_string)
        except Exception as e:
            raise BusinessLogicError(
                "无法使用 xhtml2pdf 生成 PDF。"
                f" 详情: {e!s}"
            ) from e

    if pref == "weasyprint":
        try:
            return _html_to_pdf_bytes_weasyprint(html_string)
        except Exception as e:
            raise BusinessLogicError(
                "无法使用 WeasyPrint 生成 PDF。请检查 GTK 依赖或改用 RIVEREDGE_HTML_TO_PDF_ENGINE=auto|xhtml2pdf。"
                f" 详情: {e!s}"
            ) from e

    try:
        return _html_to_pdf_bytes_weasyprint(html_string)
    except (ImportError, OSError, RuntimeError) as e:
        weasy_err = e
        logger.warning("WeasyPrint 不可用或生成失败，尝试 xhtml2pdf：{}", e)
    except Exception as e:
        weasy_err = e
        logger.warning("WeasyPrint 生成 PDF 异常，尝试 xhtml2pdf：{}", e)

    try:
        return _html_to_pdf_bytes_xhtml2pdf(html_string)
    except Exception as e2:
        raise BusinessLogicError(
            "无法生成 PDF：WeasyPrint 与 xhtml2pdf 均失败。"
            "可选：在 Windows 安装 GTK 运行时以使用 WeasyPrint（见官方文档），或设置 RIVEREDGE_HTML_TO_PDF_ENGINE=xhtml2pdf。"
            f" WeasyPrint: {weasy_err!s}；xhtml2pdf: {e2!s}"
        ) from e2


def _quotation_formal_print_allowed(quotation: Quotation) -> bool:
    """正式对外报价 PDF：审核通过、客户确认或已下推后方可打印。"""
    st = (quotation.status or "").strip()
    if st in ("已接受", "已转订单"):
        return True
    if st == "已发送" and _is_approved(quotation.review_status):
        return True
    return False


def _first_material_image_ref_for_print(images: Any) -> Tuple[str, str]:
    """
    解析物料 images 的首个引用。
    返回 (kind, value)：kind 为 'http' | 'uuid' | ''；value 为 URL 或文件 UUID。
    """
    if not images:
        return ("", "")
    first: Any = None
    if isinstance(images, str):
        first = images.strip()
    elif isinstance(images, list) and len(images) > 0:
        first = images[0]
    if first is None:
        return ("", "")
    if isinstance(first, dict):
        u = first.get("url") or first.get("src") or first.get("path") or first.get("uuid") or first.get("id")
        first = u
    if not isinstance(first, str):
        return ("", "")
    s = first.strip()
    if not s:
        return ("", "")
    if s.startswith("http://") or s.startswith("https://"):
        return ("http", s)
    return ("uuid", s)


async def _material_image_data_url_for_pdfme(tenant_id: int, images: Any) -> str:
    """
    pdfme 在浏览器内 fetch 下载 URL 易受鉴权/代理影响；打印变量内直接嵌 data URL，避免二次请求。
    缩略 256px，与预览下载 size=256 一致，控制 JSON 体积。
    """
    kind, ref = _first_material_image_ref_for_print(images)
    if kind == "http" and ref:
        return ref
    if kind != "uuid" or not ref:
        return ""
    try:
        file = await FileService.get_file_by_uuid(tenant_id, ref)
    except Exception as e:
        logger.debug("pdfme 嵌图：无法解析文件记录 uuid={} err={}", ref, e)
        return ""
    ft = (file.file_type or "").lower()
    if not ft.startswith("image/"):
        return ""
    try:
        raw = await FileService.get_file_content(tenant_id, ref)
    except Exception as e:
        logger.warning("pdfme 嵌图读取失败 uuid={}: {}", ref, e)
        return ""
    try:
        from PIL import Image

        img = Image.open(BytesIO(raw))
        has_alpha = img.mode in ("RGBA", "LA", "P")
        if has_alpha:
            img = img.convert("RGBA")
            img.thumbnail((256, 256), Image.Resampling.LANCZOS)
            buf = BytesIO()
            img.save(buf, format="PNG", optimize=True)
            buf.seek(0)
            out = buf.getvalue()
            mime = "image/png"
        else:
            if img.mode == "P":
                img = img.convert("RGB")
            elif img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.thumbnail((256, 256), Image.Resampling.LANCZOS)
            buf = BytesIO()
            img.save(buf, format="JPEG", quality=85, optimize=True)
            buf.seek(0)
            out = buf.getvalue()
            mime = "image/jpeg"
    except Exception as e:
        logger.warning("pdfme 嵌图缩略失败，回退原图: {}", e)
        out = raw
        mime = (file.file_type or "image/jpeg").split(";")[0].strip()
        if not mime.startswith("image/"):
            return ""

    b64 = base64.standard_b64encode(out).decode("ascii")
    return f"data:{mime};base64,{b64}"


class DocumentPrintService:
    """单据打印服务"""

    async def _maybe_stamp_quotation_formal(
        self, tenant_id: int, document_type: str, document_id: int
    ) -> None:
        """报价单首次成功走打印流程时记录正式文档生成时间（含默认模板路径）。"""
        if document_type != "quotation":
            return
        await Quotation.filter(
            tenant_id=tenant_id,
            id=document_id,
            deleted_at__isnull=True,
            formal_document_generated_at__isnull=True,
        ).update(formal_document_generated_at=datetime.now())

    # 单据类型到模板代码的映射
    DOCUMENT_TEMPLATE_CODES = {
        "work_order": "WORK_ORDER_PRINT",
        "production_picking": "PRODUCTION_PICKING_PRINT",
        "production_return": "PRODUCTION_RETURN_PRINT",
        "finished_goods_receipt": "FINISHED_GOODS_RECEIPT_PRINT",
        "semi_finished_goods_receipt": "FINISHED_GOODS_RECEIPT_PRINT",
        "sales_delivery": "SALES_DELIVERY_PRINT",
        "purchase_order": "PURCHASE_ORDER_PRINT",
        "purchase_receipt": "PURCHASE_RECEIPT_PRINT",
        "sales_forecast": "SALES_FORECAST_PRINT",
        "sales_order": "SALES_ORDER_PRINT",
        "other_inbound": "OTHER_INBOUND_PRINT",
        "other_outbound": "OTHER_OUTBOUND_PRINT",
        "quotation": "QUOTATION_PRINT",
        "material_borrow": "MATERIAL_BORROW_PRINT",
        "material_return": "MATERIAL_RETURN_PRINT",
        "delivery_notice": "DELIVERY_NOTICE_PRINT",
        "sample_trial": "SAMPLE_TRIAL_PRINT",
    }

    def _finalize_print_payload(
        self,
        *,
        document_type: str,
        document_id: int,
        template_code: Optional[str],
        html_content: str,
        output_format: str,
        message: str,
    ) -> Dict[str, Any]:
        """统一在 HTML 成稿后按 output_format 返回 html 或 base64 PDF。"""
        of = (output_format or "html").lower()
        if of == "pdf":
            pdf_bytes = _html_to_pdf_bytes(html_content)
            return {
                "success": True,
                "render_mode": "server_html",
                "requires_client_render": False,
                "document_type": document_type,
                "document_id": document_id,
                "template_code": template_code,
                "output_format": "pdf",
                "content": base64.b64encode(pdf_bytes).decode("ascii"),
                "content_encoding": "base64",
                "mime_type": "application/pdf",
                "message": message,
            }
        return {
            "success": True,
            "render_mode": "server_html",
            "requires_client_render": False,
            "document_type": document_type,
            "document_id": document_id,
            "template_code": template_code,
            "output_format": "html",
            "content": html_content,
            "message": message,
        }

    def _finalize_client_pdfme_payload(
        self,
        *,
        document_type: str,
        document_id: int,
        template_code: Optional[str],
        template_uuid: Any,
        output_format: str,
    ) -> Dict[str, Any]:
        """
        pdfme 模板无法在后端按设计稿成稿：返回显式契约，不再用默认 HTML 冒充模板。
        """
        tid = str(template_uuid) if template_uuid is not None else None
        of = (output_format or "html").lower()
        msg = (
            "pdfme 模板仅能在浏览器内用 @pdfme/generator 按设计稿成稿；"
            "服务端不返回替代 HTML/PDF。请调用对应 print-variables 接口获取变量后在前端生成，或使用已接入 pdfme 的业务打印入口。"
        )
        base: Dict[str, Any] = {
            "success": True,
            "render_mode": "client_pdfme",
            "requires_client_render": True,
            "document_type": document_type,
            "document_id": document_id,
            "template_code": template_code,
            "template_uuid": tid,
            "message": msg,
        }
        if of == "pdf":
            base["output_format"] = "pdf"
            base["content"] = ""
            base["content_encoding"] = None
            base["mime_type"] = "application/pdf"
        else:
            base["output_format"] = "html"
            base["content"] = ""
        return base

    async def print_document(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        template_code: Optional[str] = None,
        template_uuid: Optional[str] = None,
        output_format: str = "html"
    ) -> Dict[str, Any]:
        """
        打印单据

        Args:
            tenant_id: 租户ID
            document_type: 单据类型
            document_id: 单据ID
            template_code: 模板代码（可选，与 template_uuid 二选一）
            template_uuid: 模板UUID（可选，优先于 template_code）
            output_format: 输出格式（html/pdf）

        Returns:
            Dict: 打印结果
        """
        # 获取单据数据
        document_data = await self._get_document_data(tenant_id, document_type, document_id)
        
        # 查找打印模板：优先 template_uuid，其次 template_code，最后默认模板
        try:
            from core.models.print_template import PrintTemplate
            
            if template_uuid:
                template = await PrintTemplate.filter(
                    tenant_id=tenant_id,
                    uuid=template_uuid,
                    is_active=True,
                    deleted_at__isnull=True
                ).first()
            else:
                if not template_code:
                    template_code = self.DOCUMENT_TEMPLATE_CODES.get(document_type)
                    if not template_code:
                        raise ValidationError(f"未找到单据类型 {document_type} 的默认打印模板")
                template = await PrintTemplate.filter(
                    tenant_id=tenant_id,
                    code=template_code,
                    is_active=True,
                    deleted_at__isnull=True
                ).first()
            
            if not template:
                # 如果没有找到模板，返回基础HTML格式
                logger.warning(f"未找到打印模板 {template_code}，使用默认格式")
                res = await self._generate_default_print(
                    document_type, document_data, "html"
                )
                await self._maybe_stamp_quotation_formal(
                    tenant_id, document_type, document_id
                )
                return self._finalize_print_payload(
                    document_type=document_type,
                    document_id=document_id,
                    template_code=template_code,
                    html_content=res.get("content", ""),
                    output_format=output_format,
                    message=res.get("message", "使用默认格式打印"),
                )
        except Exception as e:
            logger.error(f"获取打印模板失败: {e}")
            res = await self._generate_default_print(
                document_type, document_data, "html"
            )
            await self._maybe_stamp_quotation_formal(
                tenant_id, document_type, document_id
            )
            return self._finalize_print_payload(
                document_type=document_type,
                document_id=document_id,
                template_code=template_code,
                html_content=res.get("content", ""),
                output_format=output_format,
                message=res.get("message", "使用默认格式打印"),
            )

        # pdfme 模板仅前端可完整渲染；服务端不返回替代版式（见 _finalize_client_pdfme_payload）
        from core.services.print.template_renderer import is_pdfme_template

        if is_pdfme_template(template.content or ""):
            logger.info(
                "打印模板 %s 为 pdfme，服务端仅返回 client_pdfme 契约，不生成 HTML/PDF",
                template_code or getattr(template, "code", None) or template.uuid,
            )
            return self._finalize_client_pdfme_payload(
                document_type=document_type,
                document_id=document_id,
                template_code=template_code or getattr(template, "code", None),
                template_uuid=getattr(template, "uuid", None),
                output_format=output_format,
            )

        # 先渲染为 HTML（再按需转 PDF）
        render_request = PrintTemplateRenderRequest(
            data=document_data,
            output_format="html",
            async_execution=False
        )

        render_result = await PrintTemplateService.render_print_template(
            tenant_id=tenant_id,
            uuid=str(template.uuid),
            data=render_request
        )

        if document_type == "quotation" and render_result.get("success", True):
            await self._maybe_stamp_quotation_formal(
                tenant_id, document_type, document_id
            )

        return self._finalize_print_payload(
            document_type=document_type,
            document_id=document_id,
            template_code=template_code or getattr(template, "code", None),
            html_content=render_result.get("content", ""),
            output_format=output_format,
            message="打印成功",
        )

    async def get_document_variables_for_print(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
    ) -> Dict[str, Any]:
        """与 `print_document` / HTML 模板渲染共用 `_get_document_data`，供 print-variables API 与前端 pdfme。"""
        return await self._get_document_data(tenant_id, document_type, document_id)

    async def _get_document_data(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int
    ) -> Dict[str, Any]:
        """获取单据数据"""
        if document_type == "work_order":
            document = await WorkOrder.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"工单不存在: {document_id}")
            return await self._format_work_order_data(document)
        
        elif document_type == "production_picking":
            document = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"生产领料单不存在: {document_id}")
            return await self._format_production_picking_data(document)
        
        elif document_type == "production_return":
            document = await ProductionReturn.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"生产退料单不存在: {document_id}")
            return await self._format_production_return_data(document)
        
        elif document_type == "finished_goods_receipt":
            document = await FinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"成品入库单不存在: {document_id}")
            return await self._format_finished_goods_receipt_data(document)

        elif document_type == "semi_finished_goods_receipt":
            document = await SemiFinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"半成品入库单不存在: {document_id}")
            return await self._format_semi_finished_goods_receipt_data(document)
        
        elif document_type == "sales_delivery":
            document = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"销售出库单不存在: {document_id}")
            return await self._format_sales_delivery_data(document)
        
        elif document_type == "purchase_order":
            document = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"采购单不存在: {document_id}")
            return await self._format_purchase_order_data(document)
        
        elif document_type == "purchase_receipt":
            document = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"采购入库单不存在: {document_id}")
            return await self._format_purchase_receipt_data(document)
        
        elif document_type == "sales_forecast":
            document = await SalesForecast.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"销售预测不存在: {document_id}")
            return await self._format_sales_forecast_data(document)
        
        elif document_type == "sales_order":
            document = await SalesOrder.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"销售订单不存在: {document_id}")
            return await self._format_sales_order_data(document)
        
        elif document_type == "other_inbound":
            document = await OtherInbound.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"其他入库单不存在: {document_id}")
            return await self._format_other_inbound_data(document)
        
        elif document_type == "other_outbound":
            document = await OtherOutbound.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"其他出库单不存在: {document_id}")
            return await self._format_other_outbound_data(document)
        
        elif document_type == "quotation":
            document = await Quotation.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"报价单不存在: {document_id}")
            if not _quotation_formal_print_allowed(document):
                raise BusinessLogicError(
                    "正式报价单需在审核通过、客户确认或已转订单后方可打印"
                )
            return await self._format_quotation_data(document)
        
        elif document_type == "material_borrow":
            document = await MaterialBorrow.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"借料单不存在: {document_id}")
            return await self._format_material_borrow_data(document)
        
        elif document_type == "material_return":
            document = await MaterialReturn.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"还料单不存在: {document_id}")
            return await self._format_material_return_data(document)
        
        elif document_type == "delivery_notice":
            from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
            from apps.kuaizhizao.models.delivery_notice_item import DeliveryNoticeItem
            document = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"送货单不存在: {document_id}")
            return await self._format_delivery_notice_data(document)
        
        elif document_type == "sample_trial":
            from apps.kuaizhizao.models.sample_trial import SampleTrial
            from apps.kuaizhizao.models.sample_trial_item import SampleTrialItem
            document = await SampleTrial.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"样品试用单不存在: {document_id}")
            return await self._format_sample_trial_data(document)
        
        else:
            raise ValidationError(f"不支持的单据类型: {document_type}")

    async def _format_work_order_data(self, work_order: WorkOrder) -> Dict[str, Any]:
        """格式化工单数据，包含工序列表"""
        operations = await WorkOrderOperation.filter(
            work_order_id=work_order.id, deleted_at__isnull=True
        ).order_by("sequence")

        data: Dict[str, Any] = {
            "document_type": "work_order",
            "code": work_order.code,
            "name": work_order.name,
            "product_code": work_order.product_code,
            "product_name": work_order.product_name,
            "quantity": str(work_order.quantity),
            "status": work_order.status,
            "production_mode": work_order.production_mode,
            "workshop_name": work_order.workshop_name,
            "work_center_name": work_order.work_center_name,
            "planned_start_date": work_order.planned_start_date.isoformat() if work_order.planned_start_date else None,
            "planned_end_date": work_order.planned_end_date.isoformat() if work_order.planned_end_date else None,
            "priority": work_order.priority,
            "remarks": work_order.remarks,
            "created_by_name": work_order.created_by_name,
            "created_at": work_order.created_at.isoformat() if work_order.created_at else None,
        }

        ops_list = []
        for op in operations:
            ops_list.append({
                "operation_code": op.operation_code,
                "operation_name": op.operation_name,
                "sequence": op.sequence,
                "status": op.status,
                "workshop_name": op.workshop_name,
                "work_center_name": op.work_center_name,
                "planned_start_date": op.planned_start_date.isoformat() if op.planned_start_date else None,
                "planned_end_date": op.planned_end_date.isoformat() if op.planned_end_date else None,
                "actual_start_date": op.actual_start_date.isoformat() if op.actual_start_date else None,
                "actual_end_date": op.actual_end_date.isoformat() if op.actual_end_date else None,
                "completed_quantity": str(op.completed_quantity) if op.completed_quantity is not None else "",
                "qualified_quantity": str(op.qualified_quantity) if op.qualified_quantity is not None else "",
                "unqualified_quantity": str(op.unqualified_quantity) if op.unqualified_quantity is not None else "",
                "assigned_worker_name": op.assigned_worker_name,
                "assigned_equipment_name": op.assigned_equipment_name,
                "remarks": op.remarks,
            })
        data["operations"] = ops_list

        return data

    async def _format_production_picking_data(self, picking: ProductionPicking) -> Dict[str, Any]:
        """格式化生产领料单数据"""
        items = await ProductionPickingItem.filter(
            tenant_id=picking.tenant_id, picking_id=picking.id
        ).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "required_quantity": str(i.required_quantity),
                "picked_quantity": str(i.picked_quantity),
                "remaining_quantity": str(i.remaining_quantity),
                "warehouse_name": i.warehouse_name,
                "location_code": i.location_code,
                "batch_number": i.batch_number,
                "status": i.status,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "production_picking",
            "code": picking.picking_code,
            "work_order_code": picking.work_order_code,
            "workshop_name": picking.workshop_name,
            "status": picking.status,
            "picker_name": picking.picker_name,
            "picking_time": picking.picking_time.isoformat() if picking.picking_time else None,
            "created_at": picking.created_at.isoformat() if picking.created_at else None,
            "items": items_data,
        }

    async def _format_production_return_data(self, ret: ProductionReturn) -> Dict[str, Any]:
        """格式化生产退料单数据"""
        items = await ProductionReturnItem.filter(
            tenant_id=ret.tenant_id, return_id=ret.id
        ).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "return_quantity": str(i.return_quantity),
                "warehouse_name": i.warehouse_name,
                "location_code": i.location_code,
                "batch_number": i.batch_number,
                "status": i.status,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "production_return",
            "code": ret.return_code,
            "work_order_code": ret.work_order_code,
            "picking_code": ret.picking_code,
            "workshop_name": ret.workshop_name,
            "warehouse_name": ret.warehouse_name,
            "status": ret.status,
            "returner_name": ret.returner_name,
            "return_time": ret.return_time.isoformat() if ret.return_time else None,
            "created_at": ret.created_at.isoformat() if ret.created_at else None,
            "items": items_data,
        }

    async def _format_finished_goods_receipt_data(self, receipt: FinishedGoodsReceipt) -> Dict[str, Any]:
        """格式化成品入库单数据"""
        items = await FinishedGoodsReceiptItem.filter(
            tenant_id=receipt.tenant_id, receipt_id=receipt.id
        ).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "receipt_quantity": str(i.receipt_quantity),
                "qualified_quantity": str(i.qualified_quantity),
                "unqualified_quantity": str(i.unqualified_quantity),
                "location_code": i.location_code,
                "batch_number": i.batch_number,
                "quality_status": i.quality_status,
                "status": i.status,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "finished_goods_receipt",
            "code": receipt.receipt_code,
            "work_order_code": receipt.work_order_code,
            "warehouse_name": receipt.warehouse_name,
            "total_quantity": str(receipt.total_quantity),
            "status": receipt.status,
            "receiver_name": receipt.receiver_name,
            "receipt_time": receipt.receipt_time.isoformat() if receipt.receipt_time else None,
            "created_at": receipt.created_at.isoformat() if receipt.created_at else None,
            "items": items_data,
        }

    async def _format_semi_finished_goods_receipt_data(self, receipt: SemiFinishedGoodsReceipt) -> Dict[str, Any]:
        """格式化半成品入库单数据（字段与成品入库单一致，便于共用打印模板）"""
        items = await SemiFinishedGoodsReceiptItem.filter(
            tenant_id=receipt.tenant_id, receipt_id=receipt.id
        ).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "receipt_quantity": str(i.receipt_quantity),
                "qualified_quantity": str(i.qualified_quantity),
                "unqualified_quantity": str(i.unqualified_quantity),
                "location_code": i.location_code,
                "batch_number": i.batch_number,
                "quality_status": i.quality_status,
                "status": i.status,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "semi_finished_goods_receipt",
            "code": receipt.receipt_code,
            "work_order_code": receipt.work_order_code,
            "warehouse_name": receipt.warehouse_name,
            "total_quantity": str(receipt.total_quantity),
            "status": receipt.status,
            "receiver_name": receipt.receiver_name,
            "receipt_time": receipt.receipt_time.isoformat() if receipt.receipt_time else None,
            "created_at": receipt.created_at.isoformat() if receipt.created_at else None,
            "items": items_data,
        }

    async def _format_sales_delivery_data(self, delivery: SalesDelivery) -> Dict[str, Any]:
        """格式化销售出库单数据"""
        items = await SalesDeliveryItem.filter(
            tenant_id=delivery.tenant_id, delivery_id=delivery.id
        ).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "delivery_quantity": str(i.delivery_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "location_code": i.location_code,
                "batch_number": i.batch_number,
                "status": i.status,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "sales_delivery",
            "code": delivery.delivery_code,
            "sales_order_code": delivery.sales_order_code,
            "customer_name": delivery.customer_name,
            "warehouse_name": delivery.warehouse_name,
            "total_quantity": str(delivery.total_quantity),
            "total_amount": str(delivery.total_amount),
            "status": delivery.status,
            "deliverer_name": delivery.deliverer_name,
            "delivery_time": delivery.delivery_time.isoformat() if delivery.delivery_time else None,
            "created_at": delivery.created_at.isoformat() if delivery.created_at else None,
            "items": items_data,
        }

    async def _format_purchase_order_data(self, order: PurchaseOrder) -> Dict[str, Any]:
        """格式化采购单数据"""
        items = await PurchaseOrderItem.filter(
            tenant_id=order.tenant_id, order_id=order.id
        ).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.unit,
                "ordered_quantity": str(i.ordered_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_price),
                "received_quantity": str(i.received_quantity),
                "outstanding_quantity": str(i.outstanding_quantity),
                "required_date": i.required_date.isoformat() if i.required_date else None,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "purchase_order",
            "code": order.order_code,
            "order_name": getattr(order, "order_name", None) or order.order_code,
            "supplier_name": order.supplier_name,
            "order_date": order.order_date.isoformat() if order.order_date else None,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
            "total_amount": str(order.total_amount),
            "status": order.status,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "items": items_data,
        }

    async def _format_purchase_receipt_data(self, receipt: PurchaseReceipt) -> Dict[str, Any]:
        """格式化采购入库单数据"""
        items = await PurchaseReceiptItem.filter(
            tenant_id=receipt.tenant_id, receipt_id=receipt.id
        ).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "receipt_quantity": str(i.receipt_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "qualified_quantity": str(i.qualified_quantity),
                "unqualified_quantity": str(i.unqualified_quantity),
                "warehouse_name": i.warehouse_name,
                "location_code": i.location_code,
                "batch_number": i.batch_number,
                "quality_status": i.quality_status,
                "status": i.status,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "purchase_receipt",
            "code": receipt.receipt_code,
            "purchase_order_code": receipt.purchase_order_code,
            "supplier_name": receipt.supplier_name,
            "warehouse_name": receipt.warehouse_name,
            "total_quantity": str(receipt.total_quantity),
            "total_amount": str(receipt.total_amount),
            "status": receipt.status,
            "receiver_name": receipt.receiver_name,
            "receipt_time": receipt.receipt_time.isoformat() if receipt.receipt_time else None,
            "created_at": receipt.created_at.isoformat() if receipt.created_at else None,
            "items": items_data,
        }

    async def _format_sales_forecast_data(self, forecast: SalesForecast) -> Dict[str, Any]:
        """格式化销售预测数据"""
        # TODO: 加载明细数据
        return {
            "document_type": "sales_forecast",
            "code": forecast.forecast_code,
            "name": forecast.forecast_name,
            "forecast_type": forecast.forecast_type,
            "start_date": forecast.start_date.isoformat() if forecast.start_date else None,
            "end_date": forecast.end_date.isoformat() if forecast.end_date else None,
            "status": forecast.status,
            "created_at": forecast.created_at.isoformat() if forecast.created_at else None,
        }

    async def _format_sales_order_data(self, order: SalesOrder) -> Dict[str, Any]:
        """格式化销售订单数据"""
        items = await SalesOrderItem.filter(
            tenant_id=order.tenant_id, sales_order_id=order.id
        ).all()

        # 批量加载物料主数据，补充 chinese_short_name / model_number / image_url
        mids = [i.material_id for i in items if getattr(i, "material_id", None)]
        material_by_id: Dict[int, Material] = {}
        if mids:
            mats = await Material.filter(tenant_id=order.tenant_id, id__in=list(set(mids))).all()
            material_by_id = {m.id: m for m in mats}

        items_data = []
        for i in items:
            mat = material_by_id.get(i.material_id) if getattr(i, "material_id", None) else None
            chinese_short_name = (mat.name if mat else None) or i.material_name or ""
            model_number = ""
            if mat and getattr(mat, "model", None) and str(mat.model).strip():
                model_number = str(mat.model).strip()
            if not model_number:
                model_number = (i.material_spec or "").strip()
            image_url = ""
            if mat:
                image_url = await _material_image_data_url_for_pdfme(order.tenant_id, mat.images)
            items_data.append(
                {
                    "material_code": i.material_code,
                    "material_name": i.material_name,
                    "material_spec": i.material_spec,
                    "material_unit": i.material_unit,
                    "order_quantity": str(i.order_quantity),
                    "delivered_quantity": str(i.delivered_quantity),
                    "remaining_quantity": str(i.remaining_quantity),
                    "unit_price": str(i.unit_price),
                    "tax_rate": str(i.tax_rate),
                    "total_amount": str(i.total_amount),
                    "delivery_date": i.delivery_date.isoformat() if i.delivery_date else None,
                    "delivery_status": i.delivery_status,
                    "work_order_code": i.work_order_code,
                    "notes": i.notes,
                    # 与报价单模板列键兼容的别名字段
                    "chinese_short_name": chinese_short_name,
                    "model_number": model_number,
                    "image_url": image_url,
                    "quote_quantity": str(i.order_quantity),
                    "required_quantity": str(i.order_quantity),
                }
            )
        return {
            "document_type": "sales_order",
            "code": order.order_code,
            "order_name": getattr(order, "order_name", None) or order.order_code,
            "customer_name": order.customer_name,
            "order_date": order.order_date.isoformat() if order.order_date else None,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
            "total_quantity": str(order.total_quantity),
            "total_amount": str(order.total_amount),
            "status": order.status,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "items": items_data,
        }

    async def _format_other_inbound_data(self, inbound: OtherInbound) -> Dict[str, Any]:
        """格式化其他入库单数据"""
        items = await OtherInboundItem.filter(tenant_id=inbound.tenant_id, inbound_id=inbound.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_unit": i.material_unit,
                "inbound_quantity": str(i.inbound_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "batch_number": i.batch_number,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "other_inbound",
            "code": inbound.inbound_code,
            "reason_type": inbound.reason_type,
            "reason_desc": inbound.reason_desc,
            "warehouse_name": inbound.warehouse_name,
            "total_quantity": str(inbound.total_quantity),
            "total_amount": str(inbound.total_amount),
            "status": inbound.status,
            "receiver_name": inbound.receiver_name,
            "receipt_time": inbound.receipt_time.isoformat() if inbound.receipt_time else None,
            "notes": inbound.notes,
            "created_at": inbound.created_at.isoformat() if inbound.created_at else None,
            "items": items_data,
        }

    async def _format_other_outbound_data(self, outbound: OtherOutbound) -> Dict[str, Any]:
        """格式化其他出库单数据"""
        items = await OtherOutboundItem.filter(tenant_id=outbound.tenant_id, outbound_id=outbound.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_unit": i.material_unit,
                "outbound_quantity": str(i.outbound_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "batch_number": i.batch_number,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "other_outbound",
            "code": outbound.outbound_code,
            "reason_type": outbound.reason_type,
            "reason_desc": outbound.reason_desc,
            "warehouse_name": outbound.warehouse_name,
            "total_quantity": str(outbound.total_quantity),
            "total_amount": str(outbound.total_amount),
            "status": outbound.status,
            "deliverer_name": outbound.deliverer_name,
            "delivery_time": outbound.delivery_time.isoformat() if outbound.delivery_time else None,
            "notes": outbound.notes,
            "created_at": outbound.created_at.isoformat() if outbound.created_at else None,
            "items": items_data,
        }

    async def _format_quotation_data(self, quotation: Quotation) -> Dict[str, Any]:
        """格式化报价单数据"""
        items = await QuotationItem.filter(tenant_id=quotation.tenant_id, quotation_id=quotation.id).all()
        material_by_id: Dict[int, Material] = {}
        mids = [i.material_id for i in items if getattr(i, "material_id", None)]
        if mids:
            mats = await Material.filter(tenant_id=quotation.tenant_id, id__in=list(set(mids))).all()
            material_by_id = {m.id: m for m in mats}

        async def _first_material_image_preview_url(tenant: int, images: Any) -> str:
            """物料 images 多为文件 UUID 列表，需转为带 token 的下载地址供前端 pdfme 拉取嵌入。"""
            if not images:
                return ""
            first: Any = None
            if isinstance(images, str):
                first = images.strip()
            elif isinstance(images, list) and len(images) > 0:
                first = images[0]
            if first is None:
                return ""
            if isinstance(first, dict):
                u = first.get("url") or first.get("src") or first.get("path") or first.get("uuid") or first.get("id")
                first = u
            if not isinstance(first, str):
                return ""
            s = first.strip()
            if not s:
                return ""
            if s.startswith("http://") or s.startswith("https://"):
                return s
            try:
                return await FilePreviewService.generate_simple_preview_url(s, tenant, size=256)
            except Exception:
                return ""

        items_data = []
        for i in items:
            mat = material_by_id.get(i.material_id) if getattr(i, "material_id", None) else None
            # 中文简称：与行快照名称一致（物料主数据名称与明细行通常同步）
            chinese_short_name = (mat.name if mat else None) or i.material_name or ""
            # 型号：优先主数据 model，否则用明细规格
            model_number = ""
            if mat and getattr(mat, "model", None) and str(mat.model).strip():
                model_number = str(mat.model).strip()
            if not model_number:
                model_number = (i.material_spec or "").strip()
            image_url = ""
            if mat:
                image_url = await _material_image_data_url_for_pdfme(quotation.tenant_id, mat.images)
                if not image_url:
                    image_url = await _first_material_image_preview_url(quotation.tenant_id, mat.images)

            items_data.append(
                {
                    "chinese_short_name": chinese_short_name,
                    "model_number": model_number,
                    "image_url": image_url,
                    "material_code": i.material_code,
                    "material_name": i.material_name,
                    "material_spec": i.material_spec,
                    "material_unit": i.material_unit,
                    "quote_quantity": str(i.quote_quantity),
                    "unit_price": str(i.unit_price),
                    "total_amount": str(i.total_amount),
                    "delivery_date": i.delivery_date.isoformat() if i.delivery_date else None,
                    "notes": i.notes,
                }
            )
        vn = int(getattr(quotation, "version_no", None) or 1)
        series = getattr(quotation, "quotation_series_code", None) or quotation.quotation_code
        return {
            "document_type": "quotation",
            "code": quotation.quotation_code,
            "quotation_series_code": series,
            "version_no": vn,
            "revision_label": f"Rev.{vn}",
            "is_latest_in_series": getattr(quotation, "is_latest_in_series", True),
            "formal_document_generated_at": (
                quotation.formal_document_generated_at.isoformat()
                if getattr(quotation, "formal_document_generated_at", None)
                else None
            ),
            "review_status": quotation.review_status,
            "currency_code": quotation.currency_code or "CNY",
            "customer_name": quotation.customer_name,
            "customer_contact": quotation.customer_contact,
            "customer_phone": quotation.customer_phone,
            "quotation_date": quotation.quotation_date.isoformat() if quotation.quotation_date else None,
            "valid_until": quotation.valid_until.isoformat() if quotation.valid_until else None,
            "delivery_date": quotation.delivery_date.isoformat() if quotation.delivery_date else None,
            "total_quantity": str(quotation.total_quantity),
            "total_amount": str(quotation.total_amount),
            "status": quotation.status,
            "salesman_name": quotation.salesman_name,
            "shipping_address": quotation.shipping_address,
            "shipping_method": quotation.shipping_method,
            "payment_terms": quotation.payment_terms,
            "notes": quotation.notes,
            "created_at": quotation.created_at.isoformat() if quotation.created_at else None,
            "items": items_data,
        }

    async def _format_material_borrow_data(self, borrow: MaterialBorrow) -> Dict[str, Any]:
        """格式化借料单数据"""
        items = await MaterialBorrowItem.filter(tenant_id=borrow.tenant_id, borrow_id=borrow.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "borrow_quantity": str(i.borrow_quantity),
                "returned_quantity": str(i.returned_quantity or 0),
                "warehouse_name": i.warehouse_name,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "material_borrow",
            "code": borrow.borrow_code,
            "warehouse_name": borrow.warehouse_name,
            "borrower_name": borrow.borrower_name,
            "department": borrow.department,
            "expected_return_date": borrow.expected_return_date.isoformat() if borrow.expected_return_date else None,
            "borrow_time": borrow.borrow_time.isoformat() if borrow.borrow_time else None,
            "total_quantity": str(borrow.total_quantity),
            "status": borrow.status,
            "notes": borrow.notes,
            "created_at": borrow.created_at.isoformat() if borrow.created_at else None,
            "items": items_data,
        }

    async def _format_material_return_data(self, return_obj: MaterialReturn) -> Dict[str, Any]:
        """格式化还料单数据"""
        items = await MaterialReturnItem.filter(tenant_id=return_obj.tenant_id, return_id=return_obj.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "return_quantity": str(i.return_quantity),
                "warehouse_name": i.warehouse_name,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "material_return",
            "code": return_obj.return_code,
            "borrow_code": return_obj.borrow_code,
            "warehouse_name": return_obj.warehouse_name,
            "returner_name": return_obj.returner_name,
            "return_time": return_obj.return_time.isoformat() if return_obj.return_time else None,
            "total_quantity": str(return_obj.total_quantity),
            "status": return_obj.status,
            "notes": return_obj.notes,
            "created_at": return_obj.created_at.isoformat() if return_obj.created_at else None,
            "items": items_data,
        }

    async def _format_delivery_notice_data(self, notice) -> Dict[str, Any]:
        """格式化送货单数据"""
        from apps.kuaizhizao.models.delivery_notice_item import DeliveryNoticeItem
        items = await DeliveryNoticeItem.filter(tenant_id=notice.tenant_id, notice_id=notice.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "notice_quantity": str(i.notice_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "delivery_notice",
            "code": notice.notice_code,
            "sales_delivery_code": notice.sales_delivery_code,
            "sales_order_code": notice.sales_order_code,
            "customer_name": notice.customer_name,
            "customer_contact": notice.customer_contact,
            "customer_phone": notice.customer_phone,
            "planned_delivery_date": notice.planned_delivery_date.isoformat() if notice.planned_delivery_date else None,
            "carrier": notice.carrier,
            "tracking_number": notice.tracking_number,
            "shipping_address": notice.shipping_address,
            "status": notice.status,
            "sent_at": notice.sent_at.isoformat() if notice.sent_at else None,
            "total_quantity": str(notice.total_quantity),
            "total_amount": str(notice.total_amount),
            "notes": notice.notes,
            "created_at": notice.created_at.isoformat() if notice.created_at else None,
            "items": items_data,
        }

    async def _format_sample_trial_data(self, trial) -> Dict[str, Any]:
        """格式化样品试用单数据"""
        from apps.kuaizhizao.models.sample_trial_item import SampleTrialItem
        items = await SampleTrialItem.filter(tenant_id=trial.tenant_id, trial_id=trial.id).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "trial_quantity": str(i.trial_quantity),
                "unit_price": str(i.unit_price),
                "total_amount": str(i.total_amount),
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "sample_trial",
            "code": trial.trial_code,
            "customer_name": trial.customer_name,
            "customer_contact": trial.customer_contact,
            "customer_phone": trial.customer_phone,
            "trial_purpose": trial.trial_purpose,
            "trial_period_start": trial.trial_period_start.isoformat() if trial.trial_period_start else None,
            "trial_period_end": trial.trial_period_end.isoformat() if trial.trial_period_end else None,
            "sales_order_code": trial.sales_order_code,
            "other_outbound_code": trial.other_outbound_code,
            "status": trial.status,
            "total_quantity": str(trial.total_quantity),
            "total_amount": str(trial.total_amount),
            "notes": trial.notes,
            "created_at": trial.created_at.isoformat() if trial.created_at else None,
            "items": items_data,
        }

    async def _generate_default_print(
        self,
        document_type: str,
        document_data: Dict[str, Any],
        output_format: str
    ) -> Dict[str, Any]:
        """生成默认打印格式（当没有模板时）"""
        # 生成简单的HTML格式
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>{document_data.get('code', '单据')}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                h1 {{ color: #333; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <h1>{document_data.get('code', '单据')}</h1>
            <table>
        """
        
        for key, value in document_data.items():
            if value is not None and key != "document_type":
                html_content += f"<tr><th>{key}</th><td>{value}</td></tr>\n"
        
        html_content += """
            </table>
        </body>
        </html>
        """
        
        return {
            "success": True,
            "document_type": document_type,
            "output_format": output_format,
            "content": html_content,
            "message": "使用默认格式打印"
        }

