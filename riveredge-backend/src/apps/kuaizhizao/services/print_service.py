"""
单据打印服务模块

提供业务单据的打印功能，支持使用打印模板渲染单据。

Author: Luigi Lu
Date: 2025-01-01
"""

import base64
import html as html_lib
import os
import platform
from io import BytesIO
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
from loguru import logger
import asyncio
import uuid as _uuid
import re
from urllib.parse import urlsplit, parse_qs

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

_FILE_DOWNLOAD_PATH_RE = re.compile(
    r"^/?api/v\d+/core/files/(?P<uuid>[0-9a-fA-F-]{32,36})/download/?$"
)


def _parse_local_file_download_src(src: str) -> Tuple[str, Optional[int]]:
    """
    判断 <img src="..."> 是否指向后端本地 /api/v{n}/core/files/{uuid}/download 资源。

    返回 (file_uuid, size)：
      - file_uuid 非空表示该 URL 是本地下载链接，可由后端直接读取文件内容内联；
      - size 解析自 query 参数，便于按缩略图大小压缩，控制 PDF 体积；
      - 若不是本地下载 URL，返回 ("", None)。
    """
    if not src:
        return ("", None)
    # 模板渲染后 src 中的 `&` 通常仍以 HTML 实体形式存在（&amp;），需先解码再切 query
    s = html_lib.unescape(src).strip()
    if not s or s.startswith("data:"):
        return ("", None)
    try:
        parts = urlsplit(s)
    except Exception:
        return ("", None)
    path = parts.path or ""
    m = _FILE_DOWNLOAD_PATH_RE.match(path)
    if not m:
        return ("", None)
    file_uuid = m.group("uuid")
    size_val: Optional[int] = None
    if parts.query:
        try:
            qs = parse_qs(parts.query, keep_blank_values=True)
            raw = (qs.get("size") or [None])[0]
            if raw is not None and str(raw).strip():
                size_val = int(str(raw).strip())
        except Exception:
            size_val = None
    return (file_uuid, size_val)


async def _build_image_data_url_for_local_file(
    tenant_id: int, file_uuid: str, size: Optional[int]
) -> str:
    """
    将本地文件 UUID 转换为可直接嵌入 <img src> 的 base64 data URL。
    透明处理 RGBA / RGB / 调色板等图像模式，按 size 缩略以控制 PDF 体积。
    解析失败返回空串，让上层保留原 src（兜底，不影响其他内容渲染）。
    """
    try:
        file = await FileService.get_file_by_uuid(tenant_id, file_uuid)
    except Exception as e:
        logger.debug("打印内联图片：未能定位文件记录 uuid={} err={}", file_uuid, e)
        return ""
    file_type = (getattr(file, "file_type", "") or "").lower()
    if not file_type.startswith("image/"):
        return ""
    try:
        raw = await FileService.get_file_content(tenant_id, file_uuid)
    except Exception as e:
        logger.warning("打印内联图片：文件内容读取失败 uuid={}: {}", file_uuid, e)
        return ""

    target = size if isinstance(size, int) and size > 0 else 512
    target = max(64, min(target, 1024))

    safety_padding = 2

    try:
        from PIL import Image

        img = Image.open(BytesIO(raw))
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            img.thumbnail((target, target), Image.Resampling.LANCZOS)
            canvas = Image.new(
                "RGBA",
                (img.width + safety_padding * 2, img.height + safety_padding * 2),
                (255, 255, 255, 0),
            )
            canvas.paste(img, (safety_padding, safety_padding), img)
            buf = BytesIO()
            canvas.save(buf, format="PNG", optimize=True)
            mime = "image/png"
        else:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.thumbnail((target, target), Image.Resampling.LANCZOS)
            canvas = Image.new(
                "RGB",
                (img.width + safety_padding * 2, img.height + safety_padding * 2),
                (255, 255, 255),
            )
            canvas.paste(img, (safety_padding, safety_padding))
            buf = BytesIO()
            canvas.save(buf, format="JPEG", quality=85, optimize=True)
            mime = "image/jpeg"
        data = buf.getvalue()
    except Exception as e:
        logger.warning("打印内联图片：缩略失败，回退原图 uuid={}: {}", file_uuid, e)
        data = raw
        mime = file_type.split(";")[0].strip() or "image/jpeg"

    return f"data:{mime};base64,{base64.standard_b64encode(data).decode('ascii')}"


_HTML_IMG_TAG_RE = re.compile(
    r"(<img\b[^>]*?\bsrc\s*=\s*)(['\"])(?P<src>.*?)\2",
    flags=re.IGNORECASE | re.DOTALL,
)


async def _inline_local_file_images_in_html(tenant_id: int, html_string: str) -> str:
    """
    将渲染好的 HTML 中所有指向后端本地下载 URL 的 <img> 替换为 base64 data URL。

    设计器历史上会把 site_logo 等图片以 `/api/v{n}/core/files/{uuid}/download?token=...&size=128`
    的方式硬编码到模板内容里。打印转 PDF 时，Playwright 的 Chromium 进程访问后端可能因
    network/防火墙/CORS/token 过期等原因失败，导致 PDF 中图片裂掉。
    渲染前把这类资源直接内联为 data URL，可避开所有外部依赖，老模板也能稳定打印。
    """
    if not html_string or "<img" not in html_string.lower():
        return html_string

    matches = list(_HTML_IMG_TAG_RE.finditer(html_string))
    if not matches:
        return html_string

    cache: Dict[str, str] = {}
    pieces: list[str] = []
    cursor = 0
    for m in matches:
        src = m.group("src")
        file_uuid, size = _parse_local_file_download_src(src)
        if not file_uuid:
            continue
        cache_key = f"{file_uuid}:{size or 0}"
        data_url = cache.get(cache_key)
        if data_url is None:
            data_url = await _build_image_data_url_for_local_file(tenant_id, file_uuid, size)
            cache[cache_key] = data_url
        if not data_url:
            continue
        pieces.append(html_string[cursor:m.start("src")])
        pieces.append(data_url)
        cursor = m.end("src")
    if cursor == 0:
        return html_string
    pieces.append(html_string[cursor:])
    return "".join(pieces)


def _inject_base_href_for_playwright(html_string: str, base_url: str) -> str:
    """
    Playwright 的 set_content 默认页面地址为 about:blank，相对 /api/... 资源无法解析。
    通过注入 <base href="..."> 让相对 URL（尤其 /api/...）可被正确请求。
    """
    if not base_url:
        return html_string
    base = base_url.rstrip("/") + "/"
    if re.search(r"<base\b", html_string, flags=re.IGNORECASE):
        return html_string
    if re.search(r"<head[^>]*>", html_string, flags=re.IGNORECASE):
        return re.sub(
            r"(<head[^>]*>)",
            lambda m: m.group(1) + f'<base href="{base}"/>',
            html_string,
            count=1,
            flags=re.IGNORECASE,
        )
    if re.search(r"<html[^>]*>", html_string, flags=re.IGNORECASE):
        return re.sub(
            r"(<html[^>]*>)",
            lambda m: m.group(1) + f'<head><base href="{base}"/></head>',
            html_string,
            count=1,
            flags=re.IGNORECASE,
        )
    return f'<!DOCTYPE html><html><head><base href="{base}"/></head><body>{html_string}</body></html>'


def _html_to_pdf_engine_pref() -> str:
    """环境变量保留兼容；当前仅支持 playwright。"""
    return os.environ.get("RIVEREDGE_HTML_TO_PDF_ENGINE", "auto").strip().lower()


async def _html_to_pdf_bytes_playwright_async(html_string: str) -> bytes:
    """
    使用 Playwright(Chromium) 将 HTML 转为 PDF。
    优点：对现代 CSS（含 flex）支持更好，接近浏览器预览效果。
    """
    try:
        from playwright.async_api import async_playwright
    except Exception as e:
        raise RuntimeError(
            "Playwright 不可用，请先安装依赖：pip install playwright "
            "并执行：playwright install chromium。"
        ) from e

    launch_args: list[str] = []
    # Linux 容器常见需求；Windows 下可保持空参数
    if platform.system() == "Linux":
        launch_args.extend(["--no-sandbox", "--disable-dev-shm-usage"])

    from infra.config.infra_config import infra_settings as settings
    base_url = settings.BASE_URL
    if not base_url:
        host = "localhost" if settings.HOST == "0.0.0.0" else settings.HOST
        base_url = f"http://{host}:{settings.PORT}"
    html_for_playwright = _inject_base_href_for_playwright(html_string, base_url)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=launch_args)
        try:
            page = await browser.new_page()

            # 仅在调试模式下落盘最终 HTML，避免常态污染后端工作目录。
            if os.environ.get("RIVEREDGE_PRINT_DEBUG", "").strip().lower() in ("1", "true", "yes"):
                try:
                    debug_path = os.path.join(os.getcwd(), "debug_last_print.html")
                    with open(debug_path, "w", encoding="utf-8") as f:
                        f.write(html_for_playwright)
                    logger.info(f"DEBUG: Final HTML captured to {debug_path}")
                except Exception as e:
                    logger.warning(f"DEBUG: Failed to capture HTML: {e}")

            await page.set_content(html_for_playwright, wait_until="networkidle")

            # 强制使用 print 媒体仿真，确保 @page、@media print、page-break-* 等生效，
            # 避免 Chromium 默认按 screen 媒体渲染导致 PDF 与设计器/预览不一致。
            try:
                await page.emulate_media(media="print")
            except Exception:
                # 部分老版本 Playwright 没有 emulate_media，忽略即可
                pass

            # 等待自定义字体就绪（如 PingFang/微软雅黑等），避免 PDF 出现回退字体差异
            try:
                await page.evaluate(
                    "() => (document.fonts && document.fonts.ready) ? document.fonts.ready : null"
                )
            except Exception:
                pass

            return await page.pdf(
                print_background=True,
                prefer_css_page_size=True,
                display_header_footer=False,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
        finally:
            await browser.close()


def _run_playwright_with_dedicated_loop(html_string: str) -> bytes:
    """
    在线程中创建独立事件循环执行 async_playwright。
    Windows 强制使用 ProactorEventLoop，确保支持 subprocess（Playwright driver）。
    """
    if platform.system() == "Windows":
        loop = asyncio.ProactorEventLoop()
    else:
        loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(_html_to_pdf_bytes_playwright_async(html_string))
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        asyncio.set_event_loop(None)
        loop.close()


async def _html_to_pdf_bytes_playwright(html_string: str) -> bytes:
    # 单一路径：仅使用 async_playwright + dedicated loop，不做兜底分支。
    return await asyncio.to_thread(_run_playwright_with_dedicated_loop, html_string)


async def _html_to_pdf_bytes(html_string: str, *, tenant_id: Optional[int] = None) -> Tuple[bytes, str]:
    """
    将完整 HTML 转为 PDF。
    当前仅支持 Playwright（需安装 Chromium）。

    若提供 tenant_id，会先把 HTML 中指向后端 /api/v{n}/core/files/{uuid}/download 的
    <img> 资源内联为 base64 data URL，避免 Playwright 浏览器跨进程访问后端时
    出现 token 过期 / 网络拒绝 / CORS 等导致的"图片裂掉"。
    """
    prepared_html = html_string
    if tenant_id is not None:
        try:
            prepared_html = await _inline_local_file_images_in_html(tenant_id, html_string)
        except Exception as e:
            logger.warning("打印 HTML 图片内联失败，回退使用原始 HTML: {}", e)
            prepared_html = html_string
    try:
        return await _html_to_pdf_bytes_playwright(prepared_html), "playwright"
    except Exception as e:
        pref = _html_to_pdf_engine_pref()
        if pref and pref not in ("", "playwright", "auto"):
            logger.warning("检测到已废弃 PDF 引擎配置 {}，当前仅支持 playwright", pref)
        logger.exception("Playwright 生成 PDF 失败")
        err_detail = f"{type(e).__name__}: {e!r}"
        raise BusinessLogicError(
            "无法使用 Playwright 生成 PDF。请确认已安装 playwright 并执行 "
            "`playwright install chromium`，并在后端进程环境设置 "
            "RIVEREDGE_HTML_TO_PDF_ENGINE=playwright。"
            f" 详情: {err_detail}"
        ) from e


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


def _is_uuid_like(value: str) -> bool:
    try:
        _uuid.UUID(value)
        return True
    except Exception:
        return False


async def _resolve_company_logo_for_print(tenant_id: int) -> str:
    """
    解析站点 Logo 为可打印值：
    - 优先返回 data URL（UUID 文件）
    - 其次返回 http(s)/data URL 原值
    - 其他格式返回空串
    """
    try:
        from core.services.system.site_setting_service import SiteSettingService
        from infra.config.infra_config import infra_settings as settings

        settings = await SiteSettingService.get_settings_with_platform_fallback(tenant_id)
        logo_raw = str((settings or {}).get("site_logo") or "").strip()
        if not logo_raw:
            return ""
        if logo_raw.startswith("data:image/"):
            return logo_raw
        if logo_raw.startswith("http://") or logo_raw.startswith("https://"):
            return logo_raw
        if logo_raw.startswith("/"):
            base_url = settings.BASE_URL
            if not base_url:
                host = "localhost" if settings.HOST == "0.0.0.0" else settings.HOST
                base_url = f"http://{host}:{settings.PORT}"
            return f"{base_url}{logo_raw}"
        if _is_uuid_like(logo_raw):
            data_url = await _material_image_data_url_for_pdfme(tenant_id, logo_raw)
            return data_url or ""
        return ""
    except Exception as e:
        logger.warning("解析打印 Logo 失败 tenant_id={}: {}", tenant_id, e)
        return ""


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
    }

    async def _finalize_print_payload(
        self,
        *,
        tenant_id: Optional[int] = None,
        document_type: str,
        document_id: int,
        template_code: Optional[str],
        html_content: str,
        output_format: str,
        message: str,
        pdf_engine_used: Optional[str] = None,
    ) -> Dict[str, Any]:
        """统一在 HTML 成稿后按 output_format 返回 html 或 base64 PDF。"""
        of = (output_format or "html").lower()
        if of == "pdf":
            pdf_bytes, actual_engine = await _html_to_pdf_bytes(html_content, tenant_id=tenant_id)
            return {
                "success": True,
                "document_type": document_type,
                "document_id": document_id,
                "template_code": template_code,
                "output_format": "pdf",
                "content": base64.b64encode(pdf_bytes).decode("ascii"),
                "content_encoding": "base64",
                "mime_type": "application/pdf",
                "pdf_engine_used": actual_engine,
                "message": message,
            }
        return {
            "success": True,
            "document_type": document_type,
            "document_id": document_id,
            "template_code": template_code,
            "output_format": "html",
            "content": html_content,
            "pdf_engine_used": pdf_engine_used or "html",
            "message": message,
        }

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
        # 补充通用模板变量：company_logo（供设计器 Logo 组件/字段引用）
        if not document_data.get("company_logo"):
            document_data["company_logo"] = await _resolve_company_logo_for_print(tenant_id)
        # 兼容历史模板字段名 {{ logo }}
        if not document_data.get("logo") and document_data.get("company_logo"):
            document_data["logo"] = document_data["company_logo"]

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
                return await self._finalize_print_payload(
                    tenant_id=tenant_id,
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
            return await self._finalize_print_payload(
                tenant_id=tenant_id,
                document_type=document_type,
                document_id=document_id,
                template_code=template_code,
                html_content=res.get("content", ""),
                output_format=output_format,
                message=res.get("message", "使用默认格式打印"),
            )

        # 历史 pdfme 模板统一降级到服务端默认渲染，避免依赖前端 @pdfme/generator。
        from core.services.print.template_renderer import is_pdfme_template

        if is_pdfme_template(template.content or ""):
            logger.info(
                "打印模板 %s 为 pdfme，降级为服务端默认模板渲染",
                template_code or getattr(template, "code", None) or template.uuid,
            )
            fallback = await self._generate_default_print(
                document_type=document_type,
                document_data=document_data,
                output_format="html",
            )
            await self._maybe_stamp_quotation_formal(
                tenant_id, document_type, document_id
            )
            return await self._finalize_print_payload(
                tenant_id=tenant_id,
                document_type=document_type,
                document_id=document_id,
                template_code=template_code or getattr(template, "code", None),
                html_content=fallback.get("content", ""),
                output_format=output_format,
                message="pdfme 模板已降级为服务端默认模板渲染",
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

        return await self._finalize_print_payload(
            tenant_id=tenant_id,
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
        """与 `print_document` / HTML 模板渲染共用 `_get_document_data`，供 print-variables API 调试预览。"""
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
            """物料 images 多为文件 UUID 列表，需转为带 token 的下载地址供打印模板访问。"""
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
                    "tax_rate": str(getattr(i, "tax_rate", None) or 0),
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
            # 与前端列表一致，避免 Rev.n 对中文用户不直观（模板仅用 revision_label 时可单独引用）
            "revision_label": f"第{vn}版",
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
            "price_type": getattr(quotation, "price_type", None) or "tax_exclusive",
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

