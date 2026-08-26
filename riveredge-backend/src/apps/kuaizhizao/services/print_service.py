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
from core.services.i18n.print_localization import PrintLocalization
from core.services.data.data_dictionary_service import DataDictionaryService
from apps.kuaizhizao.constants.price_type import DEFAULT_SALES_PRICE_TYPE
from apps.kuaizhizao.print.document_qrcode import attach_document_qrcode_fields
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
from apps.kuaizhizao.models.sales_order_change_order import SalesOrderChangeOrder, SalesOrderChangeItem
from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
from apps.kuaizhizao.models.shipment_notice_item import ShipmentNoticeItem
from apps.kuaizhizao.models.sales_return import SalesReturn
from apps.kuaizhizao.models.sales_return_item import SalesReturnItem
from apps.kuaizhizao.models.other_inbound import OtherInbound
from apps.kuaizhizao.models.other_inbound_item import OtherInboundItem
from apps.kuaizhizao.models.other_outbound import OtherOutbound
from apps.kuaizhizao.models.other_outbound_item import OtherOutboundItem
from apps.kuaizhizao.models.quotation import Quotation
from apps.kuaizhizao.models.sales_review import SalesReview
from apps.kuaizhizao.models.sales_review_item import SalesReviewItem
from apps.kuaizhizao.models.quotation_item import QuotationItem
from apps.kuaizhizao.models.sales_contract import SalesContract
from apps.kuaizhizao.models.sales_contract_item import SalesContractItem
from apps.master_data.models.material import Material
from core.services.file.file_preview_service import FilePreviewService
from core.services.file.file_service import FileService
from apps.kuaizhizao.models.material_borrow import MaterialBorrow
from apps.kuaizhizao.models.material_borrow_item import MaterialBorrowItem
from apps.kuaizhizao.models.material_return import MaterialReturn
from apps.kuaizhizao.models.material_return_item import MaterialReturnItem
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat

_FILE_DOWNLOAD_PATH_RE = re.compile(
    r"^/?api/v\d+/core/files/(?P<uuid>[0-9a-fA-F-]{32,36})/download/?$"
)


async def _resolve_print_dictionary_label(tenant_id: int, dictionary_code: str, value: Any) -> str:
    return await DataDictionaryService.resolve_dictionary_label(tenant_id, dictionary_code, value)


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


_CSS_PAGE_SIZE_RE = re.compile(
    r"@page\s*\{[^}]*?\bsize\s*:\s*"
    r"(?P<w>\d+(?:\.\d+)?(?:mm|cm|in|px))"
    r"\s+"
    r"(?P<h>\d+(?:\.\d+)?(?:mm|cm|in|px))"
    r"(?:\s+(?:portrait|landscape))?\s*;",
    re.IGNORECASE | re.DOTALL,
)

_CSS_PAGE_NAMED_SIZE_RE = re.compile(
    r"@page\s*\{[^}]*?\bsize\s*:\s*"
    r"(?P<name>A3|A4|A5|Letter|Legal)"
    r"(?:\s+(?P<orient>portrait|landscape))?\s*;",
    re.IGNORECASE | re.DOTALL,
)

# 命名纸张物理尺寸（mm），landscape 时宽高对调
_NAMED_PAPER_SIZE_MM: dict[str, tuple[float, float]] = {
    "A3": (297.0, 420.0),
    "A4": (210.0, 297.0),
    "A5": (148.0, 210.0),
    "Letter": (215.9, 279.4),
    "Legal": (215.9, 355.6),
}


def _parse_css_page_size(html_string: str) -> Optional[Tuple[str, str]]:
    """从 HTML 的 @page size 解析宽高，供 Playwright 显式传 width/height。

    Chromium 对自定义 @page（如 100mm 70mm）+ prefer_css_page_size 时常回退 Letter/A4，
    因此导出 PDF 时优先把尺寸直接传给 page.pdf。
    """
    if not html_string:
        return None
    m = _CSS_PAGE_SIZE_RE.search(html_string)
    if m:
        return m.group("w"), m.group("h")
    named = _CSS_PAGE_NAMED_SIZE_RE.search(html_string)
    if not named:
        return None
    name = named.group("name").upper()
    dims = _NAMED_PAPER_SIZE_MM.get(name)
    if not dims:
        return None
    w_mm, h_mm = dims
    orient = (named.group("orient") or "portrait").strip().lower()
    if orient == "landscape":
        w_mm, h_mm = h_mm, w_mm
    return f"{w_mm}mm", f"{h_mm}mm"


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
    page_size = _parse_css_page_size(html_for_playwright)

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

            pdf_kwargs: Dict[str, Any] = {
                "print_background": True,
                "prefer_css_page_size": True,
                "display_header_footer": False,
                # 外边距交给 CSS @page；避免 Playwright 再叠一层默认边距
                "margin": {"top": "0", "right": "0", "bottom": "0", "left": "0"},
            }
            if page_size:
                pdf_kwargs["width"] = page_size[0]
                pdf_kwargs["height"] = page_size[1]
                logger.info("PDF 按模板尺寸导出: {} x {}", page_size[0], page_size[1])
            else:
                logger.warning("未解析到 @page size，PDF 将依赖 Chromium 默认纸张")

            return await page.pdf(**pdf_kwargs)
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


def _quotation_formal_print_allowed(quotation: Quotation, *, audit_required: bool = True) -> bool:
    """正式对外报价 PDF：与 document_action_policy 一致。"""
    from apps.kuaizhizao.services.document_action_policy import derive_quotation_capabilities

    return derive_quotation_capabilities(
        quotation,
        audit_required=audit_required,
    ).print_formal.allowed


def _sales_contract_formal_print_allowed(contract: SalesContract) -> bool:
    """销售合同 PDF：支持任意业务状态打印（用于预览）。"""
    return True


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


async def _resolve_site_image_setting_for_print(tenant_id: int, setting_key: str) -> str:
    """
    解析站点图片类配置（site_logo / company_seal 等）为可打印值：
    - 优先返回 data URL（UUID 文件）
    - 其次返回 http(s)/data URL 原值
    - 其他格式返回空串
    """
    try:
        from core.services.system.site_setting_service import SiteSettingService
        from infra.config.infra_config import infra_settings as settings

        site_settings = await SiteSettingService.get_settings_with_platform_fallback(tenant_id)
        raw = str((site_settings or {}).get(setting_key) or "").strip()
        if not raw:
            return ""
        if raw.startswith("data:image/"):
            return raw
        if raw.startswith("http://") or raw.startswith("https://"):
            return raw
        if raw.startswith("/"):
            base_url = settings.BASE_URL
            if not base_url:
                host = "localhost" if settings.HOST == "0.0.0.0" else settings.HOST
                base_url = f"http://{host}:{settings.PORT}"
            return f"{base_url}{raw}"
        if _is_uuid_like(raw):
            data_url = await _material_image_data_url_for_pdfme(tenant_id, raw)
            return data_url or ""
        return ""
    except Exception as e:
        logger.warning("解析打印图片配置失败 tenant_id={} key={}: {}", tenant_id, setting_key, e)
        return ""


async def _resolve_company_logo_for_print(tenant_id: int) -> str:
    return await _resolve_site_image_setting_for_print(tenant_id, "site_logo")


async def _resolve_company_seal_for_print(tenant_id: int) -> str:
    return await _resolve_site_image_setting_for_print(tenant_id, "company_seal")


def _format_sales_contract_terms_for_print(contract_terms: Any) -> str:
    """
    将销售合同条款快照格式化为可打印文本，避免直接渲染出 Python/JSON 结构。
    """
    if contract_terms is None:
        return ""

    if isinstance(contract_terms, str):
        return contract_terms.strip()

    entries: list[Any]
    if isinstance(contract_terms, list):
        entries = contract_terms
    elif isinstance(contract_terms, dict):
        entries = [contract_terms]
    else:
        return str(contract_terms)

    chunks: list[str] = []
    for idx, entry in enumerate(entries, start=1):
        if hasattr(entry, "model_dump"):
            entry = entry.model_dump()
        if not isinstance(entry, dict):
            text = str(entry).strip()
            if text:
                chunks.append(text)
            continue

        term_name = str(entry.get("term_name") or "").strip()
        content = str(entry.get("content") or entry.get("template_content") or "").strip()
        if not content:
            continue

        if term_name:
            chunks.append(f"{idx}. {term_name}\n{content}")
        else:
            chunks.append(content)

    return "\n\n".join(chunks).strip()


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
        ).update(formal_document_generated_at=resolve_business_datetime())

    # 单据类型到模板代码的映射
    DOCUMENT_TEMPLATE_CODES = {
        "work_order": "WORK_ORDER_PRINT",
        "production_picking": "PRODUCTION_PICKING_PRINT",
        "production_return": "PRODUCTION_RETURN_PRINT",
        "finished_goods_receipt": "FINISHED_GOODS_RECEIPT_PRINT",
        "semi_finished_goods_receipt": "SEMI_FINISHED_GOODS_RECEIPT_PRINT",
        "sales_delivery": "SALES_DELIVERY_PRINT",
        "purchase_order": "PURCHASE_ORDER_PRINT",
        "purchase_receipt": "PURCHASE_RECEIPT_PRINT",
        "sales_forecast": "SALES_FORECAST_PRINT",
        "sales_order": "SALES_ORDER_PRINT",
        "other_inbound": "OTHER_INBOUND_PRINT",
        "other_outbound": "OTHER_OUTBOUND_PRINT",
        "quotation": "QUOTATION_PRINT",
        "sales_review": "SALES_REVIEW_PRINT",
        "sales_contract": "SALES_CONTRACT_PRINT",
        "material_borrow": "MATERIAL_BORROW_PRINT",
        "material_return": "MATERIAL_RETURN_PRINT",
        "delivery_notice": "DELIVERY_NOTICE_PRINT",
        "product_quality_certificate": "PRODUCT_QUALITY_CERTIFICATE_PRINT",
        "equipment_card": "EQUIPMENT_CARD_PRINT",
        "mold_card": "MOLD_CARD_PRINT",
    }

    @staticmethod
    async def _find_print_template(
        tenant_id: int,
        *,
        template_uuid: Optional[str] = None,
        template_code: Optional[str] = None,
        document_type: Optional[str] = None,
    ):
        """按 uuid / base code / document_type 解析模板（兼容 _001 后缀）。"""
        from core.models.print_template import PrintTemplate

        if template_uuid:
            return await PrintTemplate.filter(
                tenant_id=tenant_id,
                uuid=template_uuid,
                is_active=True,
                deleted_at__isnull=True,
            ).first()

        base_codes: list[str] = []
        if template_code:
            base_codes.append(str(template_code).strip().upper())
        elif document_type:
            mapped = DocumentPrintService.DOCUMENT_TEMPLATE_CODES.get(document_type)
            if mapped:
                base_codes.append(mapped)

        for base in base_codes:
            exact = await PrintTemplate.filter(
                tenant_id=tenant_id,
                code=base,
                is_active=True,
                deleted_at__isnull=True,
            ).first()
            if exact:
                return exact
            prefixed = (
                await PrintTemplate.filter(
                    tenant_id=tenant_id,
                    code__startswith=f"{base}_",
                    is_active=True,
                    deleted_at__isnull=True,
                )
                .order_by("-is_default", "-created_at")
                .first()
            )
            if prefixed:
                return prefixed

        if document_type:
            default_tpl = await PrintTemplate.filter(
                tenant_id=tenant_id,
                config__contains={"document_type": document_type},
                is_active=True,
                deleted_at__isnull=True,
                is_default=True,
            ).first()
            if default_tpl:
                return default_tpl
            return (
                await PrintTemplate.filter(
                    tenant_id=tenant_id,
                    config__contains={"document_type": document_type},
                    is_active=True,
                    deleted_at__isnull=True,
                )
                .order_by("-created_at")
                .first()
            )
        return None

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
        i18n = await PrintLocalization.for_tenant(tenant_id)
        document_data = await self._get_document_data(tenant_id, document_type, document_id, i18n=i18n)
        return await self._render_prepared_document(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
            document_data=document_data,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
            i18n=i18n,
        )

    async def print_equipment_cards(
        self,
        tenant_id: int,
        equipment_uuids: list[str],
        template_code: Optional[str] = None,
        template_uuid: Optional[str] = None,
        output_format: str = "html",
    ) -> Dict[str, Any]:
        """批量打印设备标识卡（统一走打印模板渲染）。"""
        uuids = [str(u).strip() for u in equipment_uuids if str(u).strip()]
        if not uuids:
            raise ValidationError("请选择要打印的设备")
        i18n = await PrintLocalization.for_tenant(tenant_id)
        document_data = await self._format_equipment_cards_data(tenant_id, uuids, i18n)
        first_id = int(document_data.get("document_id") or 0)
        return await self._render_prepared_document(
            tenant_id=tenant_id,
            document_type="equipment_card",
            document_id=first_id,
            document_data=document_data,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
            i18n=i18n,
        )

    async def print_mold_cards(
        self,
        tenant_id: int,
        mold_uuids: list[str],
        template_code: Optional[str] = None,
        template_uuid: Optional[str] = None,
        output_format: str = "html",
    ) -> Dict[str, Any]:
        """批量打印模具卡（统一走打印模板渲染）。"""
        uuids = [str(u).strip() for u in mold_uuids if str(u).strip()]
        if not uuids:
            raise ValidationError("请选择要打印的模具")
        i18n = await PrintLocalization.for_tenant(tenant_id)
        document_data = await self._format_mold_cards_data(tenant_id, uuids, i18n)
        first_id = int(document_data.get("document_id") or 0)
        return await self._render_prepared_document(
            tenant_id=tenant_id,
            document_type="mold_card",
            document_id=first_id,
            document_data=document_data,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
            i18n=i18n,
        )

    async def _render_prepared_document(
        self,
        *,
        tenant_id: int,
        document_type: str,
        document_id: int,
        document_data: Dict[str, Any],
        template_code: Optional[str] = None,
        template_uuid: Optional[str] = None,
        output_format: str = "html",
        i18n: PrintLocalization | None = None,
    ) -> Dict[str, Any]:
        """在已准备好的单据变量上查找模板并渲染（html/pdf）。"""
        loc = i18n or await PrintLocalization.for_tenant(tenant_id)
        document_data["print_time"] = loc.format_datetime(resolve_business_datetime()) or resolve_business_datetime().strftime("%Y-%m-%d %H:%M")
        if not document_data.get("company_logo"):
            document_data["company_logo"] = await _resolve_company_logo_for_print(tenant_id)
        if not document_data.get("logo") and document_data.get("company_logo"):
            document_data["logo"] = document_data["company_logo"]
        if not document_data.get("company_seal"):
            document_data["company_seal"] = await _resolve_company_seal_for_print(tenant_id)

        try:
            if template_uuid or template_code:
                template = await self._find_print_template(
                    tenant_id,
                    template_uuid=template_uuid,
                    template_code=template_code,
                    document_type=document_type,
                )
            else:
                template = await self._find_print_template(
                    tenant_id,
                    document_type=document_type,
                )
                if template:
                    template_code = template.code
                else:
                    template_code = self.DOCUMENT_TEMPLATE_CODES.get(document_type)
                    if not template_code:
                        raise ValidationError(f"未找到单据类型 {document_type} 的默认打印模板")

            if not template:
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

    @staticmethod
    def _finalize_print_context(
        document_type: str,
        document: Any,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        return attach_document_qrcode_fields(
            document_type=document_type,
            document=document,
            data=data,
        )

    async def _get_document_data(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        *,
        i18n: PrintLocalization | None = None,
    ) -> Dict[str, Any]:
        """获取单据数据"""
        loc = i18n or await PrintLocalization.for_tenant(tenant_id)
        if document_type == "work_order":
            document = await WorkOrder.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"工单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_work_order_data(document, loc)
            )
        
        elif document_type == "production_picking":
            document = await ProductionPicking.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"生产领料单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_production_picking_data(document)
            )
        
        elif document_type == "production_return":
            document = await ProductionReturn.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"生产退料单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_production_return_data(document)
            )
        
        elif document_type == "finished_goods_receipt":
            document = await FinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"成品入库单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_finished_goods_receipt_data(document)
            )

        elif document_type == "semi_finished_goods_receipt":
            document = await SemiFinishedGoodsReceipt.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"半成品入库单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_semi_finished_goods_receipt_data(document)
            )
        
        elif document_type == "sales_delivery":
            document = await SalesDelivery.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"销售出库单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_sales_delivery_data(document)
            )
        
        elif document_type == "purchase_order":
            document = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"采购单不存在: {document_id}")
            return await self._format_purchase_order_data(document, loc)
        
        elif document_type == "purchase_receipt":
            document = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"采购入库单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_purchase_receipt_data(document)
            )
        
        elif document_type == "sales_forecast":
            document = await SalesForecast.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"销售预测不存在: {document_id}")
            return await self._format_sales_forecast_data(document)
        
        elif document_type == "sales_order":
            document = await SalesOrder.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"销售订单不存在: {document_id}")
            return await self._format_sales_order_data(document, loc)

        elif document_type == "sales_order_change":
            document = await SalesOrderChangeOrder.get_or_none(
                tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
            )
            if not document:
                raise NotFoundError(f"销售变更单不存在: {document_id}")
            return await self._format_sales_order_change_data(document)

        elif document_type == "shipment_notice":
            document = await ShipmentNotice.get_or_none(
                tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
            )
            if not document:
                raise NotFoundError(f"发货通知单不存在: {document_id}")
            return await self._format_shipment_notice_data(document)

        elif document_type == "sales_return":
            document = await SalesReturn.get_or_none(
                tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
            )
            if not document:
                raise NotFoundError(f"销售退货单不存在: {document_id}")
            return await self._format_sales_return_data(document)
        
        elif document_type == "other_inbound":
            document = await OtherInbound.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"其他入库单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_other_inbound_data(document)
            )
        
        elif document_type == "other_outbound":
            document = await OtherOutbound.get_or_none(tenant_id=tenant_id, id=document_id)
            if not document:
                raise NotFoundError(f"其他出库单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_other_outbound_data(document)
            )
        
        elif document_type == "sales_review":
            document = await SalesReview.get_or_none(
                tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
            )
            if not document:
                raise NotFoundError(f"订单评审不存在: {document_id}")
            return await self._format_sales_review_data(document)

        elif document_type == "quotation":
            document = await Quotation.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"报价单不存在: {document_id}")
            from infra.services.business_config_service import BusinessConfigService

            audit_required = await BusinessConfigService().check_audit_required(
                tenant_id, "quotation"
            )
            if not _quotation_formal_print_allowed(document, audit_required=audit_required):
                raise BusinessLogicError(
                    "正式报价单需在审核通过、客户确认或已转订单后方可打印"
                )
            return await self._format_quotation_data(document)

        elif document_type == "sales_contract":
            document = await SalesContract.get_or_none(
                tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
            )
            if not document:
                raise NotFoundError(f"销售合同不存在: {document_id}")
            if not _sales_contract_formal_print_allowed(document):
                raise BusinessLogicError("正式销售合同需在审核通过且已生效后方可打印")
            return await self._format_sales_contract_data(document)
        
        elif document_type == "material_borrow":
            document = await MaterialBorrow.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"借料单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_material_borrow_data(document)
            )
        
        elif document_type == "material_return":
            document = await MaterialReturn.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"还料单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_material_return_data(document)
            )
        
        elif document_type == "delivery_notice":
            from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
            document = await DeliveryNotice.get_or_none(tenant_id=tenant_id, id=document_id, deleted_at__isnull=True)
            if not document:
                raise NotFoundError(f"送货单不存在: {document_id}")
            return self._finalize_print_context(
                document_type, document, await self._format_delivery_notice_data(document)
            )

        elif document_type == "product_quality_certificate":
            from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
            inspection = await FinishedGoodsInspection.get_or_none(
                tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
            )
            if not inspection:
                raise NotFoundError(f"成品检验单不存在: {document_id}")
            if inspection.quality_status != "合格":
                raise BusinessLogicError("只有合格的成品检验单才能打印合格证")
            if not inspection.certificate_issued:
                raise BusinessLogicError("请先出具合格证后再打印")
            return await self._format_product_quality_certificate_data(inspection)

        elif document_type == "equipment_card":
            from apps.kuaizhizao.models.equipment import Equipment

            equipment = await Equipment.get_or_none(
                tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
            )
            if not equipment:
                raise NotFoundError(f"设备不存在: {document_id}")
            return await self._format_equipment_cards_data(
                tenant_id, [str(equipment.uuid)], loc
            )

        elif document_type == "mold_card":
            from apps.kuaizhizao.models.mold import Mold

            mold = await Mold.get_or_none(
                tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
            )
            if not mold:
                raise NotFoundError(f"模具不存在: {document_id}")
            return await self._format_mold_cards_data(
                tenant_id, [str(mold.uuid)], loc
            )

        else:
            raise ValidationError(f"不支持的单据类型: {document_type}")

    async def _format_work_order_data(self, work_order: WorkOrder, i18n: PrintLocalization) -> Dict[str, Any]:
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
            "status": i18n.document_status(work_order.status),
            "status_code": work_order.status,
            "production_mode": work_order.production_mode,
            "workshop_name": work_order.workshop_name,
            "work_center_name": work_order.work_center_name,
            "planned_start_date": i18n.format_datetime(work_order.planned_start_date),
            "planned_end_date": i18n.format_datetime(work_order.planned_end_date),
            "priority": work_order.priority,
            "remarks": work_order.remarks,
            "created_by_name": work_order.created_by_name,
            "created_at": i18n.format_datetime(work_order.created_at),
        }

        ops_list = []
        for op in operations:
            ops_list.append({
                "operation_code": op.operation_code,
                "operation_name": op.operation_name,
                "sequence": op.sequence,
                "status": i18n.operation_status(op.status),
                "status_code": op.status,
                "workshop_name": op.workshop_name,
                "work_center_name": op.work_center_name,
                "planned_start_date": i18n.format_datetime(op.planned_start_date),
                "planned_end_date": i18n.format_datetime(op.planned_end_date),
                "actual_start_date": i18n.format_datetime(op.actual_start_date),
                "actual_end_date": i18n.format_datetime(op.actual_end_date),
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
            "picking_time": to_api_isoformat(picking.picking_time) if picking.picking_time else None,
            "created_at": to_api_isoformat(picking.created_at) if picking.created_at else None,
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
            "return_time": to_api_isoformat(ret.return_time) if ret.return_time else None,
            "created_at": to_api_isoformat(ret.created_at) if ret.created_at else None,
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
            "receipt_time": to_api_isoformat(receipt.receipt_time) if receipt.receipt_time else None,
            "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None,
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
            "receipt_time": to_api_isoformat(receipt.receipt_time) if receipt.receipt_time else None,
            "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None,
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
        delivery_time = (
            to_api_isoformat(delivery.delivery_time) if delivery.delivery_time else None
        )
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
            "delivery_time": delivery_time,
            # 预设模板字段名为 delivery_date，与 delivery_time 同源
            "delivery_date": delivery_time,
            "shipping_method": await _resolve_print_dictionary_label(
                delivery.tenant_id, "SHIPPING_METHOD", getattr(delivery, "shipping_method", None)
            ),
            "tracking_number": getattr(delivery, "tracking_number", None) or "",
            "shipping_address": getattr(delivery, "shipping_address", None) or "",
            "notes": getattr(delivery, "notes", None) or "",
            "created_at": to_api_isoformat(delivery.created_at) if delivery.created_at else None,
            "items": items_data,
        }

    async def _format_purchase_order_data(
        self, order: PurchaseOrder, i18n: PrintLocalization
    ) -> Dict[str, Any]:
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
                "required_date": to_api_isoformat(i.required_date) if i.required_date else None,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "purchase_order",
            "code": order.order_code,
            "order_name": getattr(order, "order_name", None) or order.order_code,
            "supplier_name": order.supplier_name,
            "order_date": to_api_isoformat(order.order_date) if order.order_date else None,
            "delivery_date": to_api_isoformat(order.delivery_date) if order.delivery_date else None,
            "total_amount": str(order.total_amount),
            "status": i18n.document_status(order.status),
            "status_code": order.status,
            "created_at": to_api_isoformat(order.created_at) if order.created_at else None,
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
            "receipt_time": to_api_isoformat(receipt.receipt_time) if receipt.receipt_time else None,
            "created_at": to_api_isoformat(receipt.created_at) if receipt.created_at else None,
            "items": items_data,
        }

    async def _format_sales_review_data(self, review: SalesReview) -> Dict[str, Any]:
        """格式化订单评审打印数据"""
        items = await SalesReviewItem.filter(
            tenant_id=review.tenant_id, sales_review_id=review.id
        ).order_by("line_no").all()
        items_data = [
            {
                "line_no": i.line_no,
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "quantity": str(i.quantity),
                "unit_price": str(i.unit_price),
                "amount": str(i.amount),
                "tech_requirements": i.tech_requirements,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "sales_review",
            "code": review.review_code,
            "review_code": review.review_code,
            "customer_name": review.customer_name,
            "customer_code": review.customer_code,
            "customer_contact": review.customer_contact,
            "customer_phone": review.customer_phone,
            "project_name": review.project_name,
            "review_date": to_api_isoformat(review.review_date) if review.review_date else None,
            "delivery_date": to_api_isoformat(review.delivery_date) if review.delivery_date else None,
            "urgency": review.urgency,
            "risk_level": review.risk_level,
            "settlement_method": review.settlement_method,
            "payment_cycle": review.payment_cycle,
            "delivery_location": review.delivery_location,
            "transport_method": review.transport_method,
            "status": review.status,
            "review_round": review.review_round,
            "salesman_name": review.salesman_name,
            "quotation_code": review.quotation_code,
            "sales_order_code": review.sales_order_code,
            "total_quantity": str(review.total_quantity),
            "total_amount": str(review.total_amount),
            "sales_opinion": review.sales_opinion,
            "final_conclusion": review.final_conclusion,
            "remarks": review.remarks,
            "created_at": to_api_isoformat(review.created_at) if review.created_at else None,
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
            "start_date": to_api_isoformat(forecast.start_date) if forecast.start_date else None,
            "end_date": to_api_isoformat(forecast.end_date) if forecast.end_date else None,
            "status": forecast.status,
            "created_at": to_api_isoformat(forecast.created_at) if forecast.created_at else None,
        }

    async def _format_sales_order_data(
        self, order: SalesOrder, i18n: PrintLocalization
    ) -> Dict[str, Any]:
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
                    "delivery_date": to_api_isoformat(i.delivery_date) if i.delivery_date else None,
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
            "order_date": to_api_isoformat(order.order_date) if order.order_date else None,
            "delivery_date": to_api_isoformat(order.delivery_date) if order.delivery_date else None,
            "total_quantity": str(order.total_quantity),
            "total_amount": str(order.total_amount),
            "status": i18n.document_status(order.status),
            "status_code": order.status,
            "created_at": to_api_isoformat(order.created_at) if order.created_at else None,
            "items": items_data,
        }

    async def _format_sales_order_change_data(self, change_order: SalesOrderChangeOrder) -> Dict[str, Any]:
        """格式化销售变更单数据"""
        items = await SalesOrderChangeItem.filter(
            tenant_id=change_order.tenant_id, change_order_id=change_order.id
        ).all()
        items_data = [
            {
                "line_no": i.line_no,
                "change_type": i.change_type,
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "before_quantity": str(i.before_quantity or 0),
                "after_quantity": str(i.after_quantity or 0),
                "before_unit_price": str(i.before_unit_price or 0),
                "after_unit_price": str(i.after_unit_price or 0),
                "before_amount": str(i.before_amount or 0),
                "after_amount": str(i.after_amount or 0),
                "delta_amount": str(i.delta_amount or 0),
                "before_delivery_date": to_api_isoformat(i.before_delivery_date) if i.before_delivery_date else None,
                "after_delivery_date": to_api_isoformat(i.after_delivery_date) if i.after_delivery_date else None,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "sales_order_change",
            "code": change_order.change_code,
            "change_code": change_order.change_code,
            "source_order_code": change_order.source_order_code,
            "change_version": int(change_order.change_version or 1),
            "customer_name": change_order.customer_name,
            "change_reason": change_order.change_reason,
            "change_category": change_order.change_category,
            "effective_date": to_api_isoformat(change_order.effective_date) if change_order.effective_date else None,
            "status": change_order.status,
            "review_status": change_order.review_status,
            "reviewer_name": change_order.reviewer_name,
            "review_time": to_api_isoformat(change_order.review_time) if change_order.review_time else None,
            "before_total_quantity": str(change_order.before_total_quantity or 0),
            "after_total_quantity": str(change_order.after_total_quantity or 0),
            "before_total_amount": str(change_order.before_total_amount or 0),
            "after_total_amount": str(change_order.after_total_amount or 0),
            "delta_amount": str(change_order.delta_amount or 0),
            "applied_at": to_api_isoformat(change_order.applied_at) if change_order.applied_at else None,
            "notes": change_order.notes,
            "created_at": to_api_isoformat(change_order.created_at) if change_order.created_at else None,
            "items": items_data,
        }

    async def _format_shipment_notice_data(self, notice: ShipmentNotice) -> Dict[str, Any]:
        """格式化发货通知单数据"""
        items = await ShipmentNoticeItem.filter(
            tenant_id=notice.tenant_id, notice_id=notice.id
        ).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "notice_quantity": str(i.notice_quantity or 0),
                "unit_price": str(i.unit_price or 0),
                "total_amount": str(i.total_amount or 0),
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "shipment_notice",
            "code": notice.notice_code,
            "notice_code": notice.notice_code,
            "sales_order_code": notice.sales_order_code,
            "customer_name": notice.customer_name,
            "customer_contact": notice.customer_contact,
            "customer_phone": notice.customer_phone,
            "warehouse_name": notice.warehouse_name,
            "planned_ship_date": to_api_isoformat(notice.planned_ship_date) if notice.planned_ship_date else None,
            "shipping_address": notice.shipping_address,
            "status": notice.status,
            "notified_at": to_api_isoformat(notice.notified_at) if notice.notified_at else None,
            "sales_delivery_code": notice.sales_delivery_code,
            "total_quantity": str(notice.total_quantity or 0),
            "total_amount": str(notice.total_amount or 0),
            "notes": notice.notes,
            "created_at": to_api_isoformat(notice.created_at) if notice.created_at else None,
            "items": items_data,
        }

    async def _format_sales_return_data(self, sales_return: SalesReturn) -> Dict[str, Any]:
        """格式化销售退货单数据"""
        items = await SalesReturnItem.filter(
            tenant_id=sales_return.tenant_id, return_id=sales_return.id
        ).all()
        items_data = [
            {
                "material_code": i.material_code,
                "material_name": i.material_name,
                "material_spec": i.material_spec,
                "material_unit": i.material_unit,
                "return_quantity": str(i.return_quantity or 0),
                "unit_price": str(i.unit_price or 0),
                "total_amount": str(i.total_amount or 0),
                "batch_number": i.batch_number,
                "location_code": i.location_code,
                "status": i.status,
                "notes": i.notes,
            }
            for i in items
        ]
        return {
            "document_type": "sales_return",
            "code": sales_return.return_code,
            "return_code": sales_return.return_code,
            "sales_delivery_code": sales_return.sales_delivery_code,
            "sales_order_code": sales_return.sales_order_code,
            "customer_name": sales_return.customer_name,
            "warehouse_name": sales_return.warehouse_name,
            "return_time": to_api_isoformat(sales_return.return_time) if sales_return.return_time else None,
            "returner_name": sales_return.returner_name,
            "review_status": sales_return.review_status,
            "reviewer_name": sales_return.reviewer_name,
            "review_time": to_api_isoformat(sales_return.review_time) if sales_return.review_time else None,
            "return_reason": sales_return.return_reason,
            "return_type": sales_return.return_type,
            "status": sales_return.status,
            "total_quantity": str(sales_return.total_quantity or 0),
            "total_amount": str(sales_return.total_amount or 0),
            "shipping_method": await _resolve_print_dictionary_label(
                sales_return.tenant_id, "SHIPPING_METHOD", sales_return.shipping_method
            ),
            "tracking_number": sales_return.tracking_number,
            "shipping_address": sales_return.shipping_address,
            "notes": sales_return.notes,
            "created_at": to_api_isoformat(sales_return.created_at) if sales_return.created_at else None,
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
            "receipt_time": to_api_isoformat(inbound.receipt_time) if inbound.receipt_time else None,
            "notes": inbound.notes,
            "created_at": to_api_isoformat(inbound.created_at) if inbound.created_at else None,
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
            "delivery_time": to_api_isoformat(outbound.delivery_time) if outbound.delivery_time else None,
            "notes": outbound.notes,
            "created_at": to_api_isoformat(outbound.created_at) if outbound.created_at else None,
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
                    "delivery_date": to_api_isoformat(i.delivery_date) if i.delivery_date else None,
                    "notes": i.notes,
                }
            )
        vn = int(getattr(quotation, "version_no", None) or 1)
        series = getattr(quotation, "quotation_series_code", None) or quotation.quotation_code
        shipping_method_label = await _resolve_print_dictionary_label(
            quotation.tenant_id, "SHIPPING_METHOD", quotation.shipping_method
        )
        payment_terms_label = await _resolve_print_dictionary_label(
            quotation.tenant_id, "PAYMENT_TERMS", quotation.payment_terms
        )
        return {
            "document_type": "quotation",
            "code": quotation.quotation_code,
            "quotation_series_code": series,
            "version_no": vn,
            # 与前端列表一致，避免 Rev.n 对中文用户不直观（模板仅用 revision_label 时可单独引用）
            "revision_label": f"第{vn}版",
            "is_latest_in_series": getattr(quotation, "is_latest_in_series", True),
            "formal_document_generated_at": (
                to_api_isoformat(quotation.formal_document_generated_at)
                if getattr(quotation, "formal_document_generated_at", None)
                else None
            ),
            "review_status": quotation.review_status,
            "currency_code": quotation.currency_code or "CNY",
            "customer_name": quotation.customer_name,
            "customer_contact": quotation.customer_contact,
            "customer_phone": quotation.customer_phone,
            "quotation_date": to_api_isoformat(quotation.quotation_date) if quotation.quotation_date else None,
            "valid_until": to_api_isoformat(quotation.valid_until) if quotation.valid_until else None,
            "delivery_date": to_api_isoformat(quotation.delivery_date) if quotation.delivery_date else None,
            "total_quantity": str(quotation.total_quantity),
            "total_amount": str(quotation.total_amount),
            "price_type": getattr(quotation, "price_type", None) or DEFAULT_SALES_PRICE_TYPE,
            "status": quotation.status,
            "salesman_name": quotation.salesman_name,
            "shipping_address": quotation.shipping_address,
            "shipping_method": shipping_method_label,
            "payment_terms": payment_terms_label,
            "notes": quotation.notes,
            "created_at": to_api_isoformat(quotation.created_at) if quotation.created_at else None,
            "items": items_data,
        }

    async def _format_sales_contract_data(self, contract: SalesContract) -> Dict[str, Any]:
        """格式化销售合同数据"""
        items = await SalesContractItem.filter(
            tenant_id=contract.tenant_id, contract_id=contract.id
        ).all()
        material_by_id: Dict[int, Material] = {}
        mids = [i.material_id for i in items if getattr(i, "material_id", None)]
        if mids:
            mats = await Material.filter(tenant_id=contract.tenant_id, id__in=list(set(mids))).all()
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
                image_url = await _material_image_data_url_for_pdfme(contract.tenant_id, mat.images)
            items_data.append(
                {
                    "material_code": i.material_code,
                    "material_name": i.material_name,
                    "material_spec": i.material_spec,
                    "material_unit": i.material_unit,
                    "contract_quantity": str(i.contract_quantity),
                    "released_quantity": str(i.released_quantity or 0),
                    "unit_price": str(i.unit_price),
                    "tax_rate": str(getattr(i, "tax_rate", None) or 0),
                    "total_amount": str(i.total_amount),
                    "delivery_date": to_api_isoformat(i.delivery_date) if i.delivery_date else None,
                    "notes": i.notes,
                    "chinese_short_name": chinese_short_name,
                    "model_number": model_number,
                    "image_url": image_url,
                    "quote_quantity": str(i.contract_quantity),
                }
            )
        rem_qty = max(
            0,
            float(contract.total_quantity or 0) - float(contract.released_quantity or 0),
        )
        rem_amt = max(
            0,
            float(contract.total_amount or 0) - float(contract.released_amount or 0),
        )
        shipping_method_label = await _resolve_print_dictionary_label(
            contract.tenant_id, "SHIPPING_METHOD", contract.shipping_method
        )
        payment_terms_label = await _resolve_print_dictionary_label(
            contract.tenant_id, "PAYMENT_TERMS", contract.payment_terms
        )
        return {
            "document_type": "sales_contract",
            "code": contract.contract_code,
            "contract_code": contract.contract_code,
            "contract_type": contract.contract_type,
            "version_no": int(getattr(contract, "version_no", None) or 1),
            "review_status": contract.review_status,
            "currency_code": contract.currency_code or "CNY",
            "customer_name": contract.customer_name,
            "customer_contact": contract.customer_contact,
            "customer_phone": contract.customer_phone,
            "contract_date": to_api_isoformat(contract.contract_date) if contract.contract_date else None,
            "valid_from": to_api_isoformat(contract.valid_from) if contract.valid_from else None,
            "valid_to": to_api_isoformat(contract.valid_to) if contract.valid_to else None,
            "total_quantity": str(contract.total_quantity),
            "total_amount": str(contract.total_amount),
            "released_quantity": str(contract.released_quantity or 0),
            "released_amount": str(contract.released_amount or 0),
            "remaining_quantity": str(rem_qty),
            "remaining_amount": str(rem_amt),
            "price_type": getattr(contract, "price_type", None) or DEFAULT_SALES_PRICE_TYPE,
            "status": contract.status,
            "salesman_name": contract.salesman_name,
            "shipping_address": contract.shipping_address,
            "shipping_method": shipping_method_label,
            "payment_terms": payment_terms_label,
            "quotation_code": contract.quotation_code,
            "term_group_name": contract.term_group_name,
            "contract_terms": _format_sales_contract_terms_for_print(contract.contract_terms),
            "contract_terms_raw": contract.contract_terms,
            "notes": contract.notes,
            "created_at": to_api_isoformat(contract.created_at) if contract.created_at else None,
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
            "expected_return_date": to_api_isoformat(borrow.expected_return_date) if borrow.expected_return_date else None,
            "borrow_time": to_api_isoformat(borrow.borrow_time) if borrow.borrow_time else None,
            "total_quantity": str(borrow.total_quantity),
            "status": borrow.status,
            "notes": borrow.notes,
            "created_at": to_api_isoformat(borrow.created_at) if borrow.created_at else None,
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
            "return_time": to_api_isoformat(return_obj.return_time) if return_obj.return_time else None,
            "total_quantity": str(return_obj.total_quantity),
            "status": return_obj.status,
            "notes": return_obj.notes,
            "created_at": to_api_isoformat(return_obj.created_at) if return_obj.created_at else None,
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
            "planned_delivery_date": to_api_isoformat(notice.planned_delivery_date) if notice.planned_delivery_date else None,
            "carrier": notice.carrier,
            "tracking_number": notice.tracking_number,
            "shipping_address": notice.shipping_address,
            "status": notice.status,
            "sent_at": to_api_isoformat(notice.sent_at) if notice.sent_at else None,
            "total_quantity": str(notice.total_quantity),
            "total_amount": str(notice.total_amount),
            "notes": notice.notes,
            "created_at": to_api_isoformat(notice.created_at) if notice.created_at else None,
            "items": items_data,
        }

    async def _format_product_quality_certificate_data(self, inspection) -> Dict[str, Any]:
        """格式化产品合格证打印变量（来源：成品检验单）。"""
        return {
            "document_type": "product_quality_certificate",
            "code": inspection.inspection_code,
            "inspection_code": inspection.inspection_code,
            "release_certificate": inspection.release_certificate,
            "certificate_issued": inspection.certificate_issued,
            "material_code": inspection.material_code,
            "material_name": inspection.material_name,
            "material_spec": inspection.material_spec,
            "batch_number": inspection.batch_number,
            "inspection_quantity": str(inspection.inspection_quantity),
            "qualified_quantity": str(inspection.qualified_quantity),
            "quality_status": inspection.quality_status,
            "inspection_result": inspection.inspection_result,
            "inspector_name": inspection.inspector_name,
            "inspection_time": to_api_isoformat(inspection.inspection_time) if inspection.inspection_time else None,
            "work_order_code": inspection.work_order_code,
            "sales_order_code": inspection.sales_order_code,
            "customer_name": inspection.customer_name,
            "inspection_standard": inspection.inspection_standard,
            "notes": inspection.notes,
        }

    @staticmethod
    async def resolve_quality_certificates_for_delivery_notice(
        tenant_id: int,
        notice_id: int,
    ) -> list[Dict[str, Any]]:
        """按送货单明细关联已出具合格证的成品检验单。"""
        from apps.kuaizhizao.models.delivery_notice import DeliveryNotice
        from apps.kuaizhizao.models.delivery_notice_item import DeliveryNoticeItem
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

        notice = await DeliveryNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            raise NotFoundError(f"送货单不存在: {notice_id}")

        items = await DeliveryNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()
        material_ids = {i.material_id for i in items if i.material_id}
        if not material_ids:
            return []

        query = FinishedGoodsInspection.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            material_id__in=list(material_ids),
            certificate_issued=True,
            quality_status="合格",
        )
        if notice.sales_order_id:
            query = query.filter(sales_order_id=notice.sales_order_id)

        inspections = await query.order_by("-inspection_time", "-id").all()
        seen_materials: set[int] = set()
        results: list[Dict[str, Any]] = []
        for insp in inspections:
            if insp.material_id in seen_materials:
                continue
            seen_materials.add(insp.material_id)
            results.append(
                {
                    "inspection_id": insp.id,
                    "inspection_code": insp.inspection_code,
                    "material_code": insp.material_code,
                    "material_name": insp.material_name,
                    "release_certificate": insp.release_certificate,
                }
            )
        return results

    async def _format_equipment_cards_data(
        self,
        tenant_id: int,
        equipment_uuids: list[str],
        i18n: PrintLocalization | None = None,
    ) -> Dict[str, Any]:
        """格式化设备标识卡打印变量（支持批量）。"""
        from apps.kuaizhizao.models.equipment import Equipment
        from core.services.qrcode.qrcode_service import QRCodeService

        loc = i18n or await PrintLocalization.for_tenant(tenant_id)
        ordered_uuids = [str(u).strip() for u in equipment_uuids if str(u).strip()]
        if not ordered_uuids:
            raise ValidationError("请选择要打印的设备")

        rows = await Equipment.filter(
            tenant_id=tenant_id,
            uuid__in=ordered_uuids,
            deleted_at__isnull=True,
        ).all()
        by_uuid = {str(eq.uuid): eq for eq in rows}
        missing = [u for u in ordered_uuids if u not in by_uuid]
        if missing:
            raise NotFoundError(f"设备不存在: {missing[0]}")

        def _fmt_date(value: Any) -> str:
            if value is None or value == "":
                return ""
            if hasattr(value, "strftime"):
                return value.strftime("%Y-%m-%d")
            text = str(value).strip()
            return text[:10] if text else ""

        items: list[Dict[str, Any]] = []
        for uuid in ordered_uuids:
            eq = by_uuid[uuid]
            # 模块尺寸偏小，避免 PNG 固有像素在打印时撑破单元格（版式仍以库内模板为准）
            qr = QRCodeService.generate_equipment_qrcode(
                equipment_uuid=str(eq.uuid),
                equipment_code=eq.code or "",
                equipment_name=eq.name or "",
                size=3,
                border=1,
            )
            line_name = (getattr(eq, "production_line_name", None) or "").strip()
            workshop_name = (eq.workshop_name or "").strip()
            affiliation = line_name or workshop_name
            items.append(
                {
                    "id": eq.id,
                    "uuid": str(eq.uuid),
                    "code": eq.code,
                    "name": eq.name,
                    "model": eq.model,
                    "type": eq.type,
                    "workshop_name": eq.workshop_name,
                    "production_line_name": getattr(eq, "production_line_name", None),
                    "affiliation": affiliation,
                    "purchase_date": _fmt_date(eq.purchase_date),
                    "installation_date": _fmt_date(eq.installation_date),
                    "status": loc.document_status(eq.status) if eq.status else eq.status,
                    "qrcode_image": qr.get("qrcode_image") or "",
                }
            )

        first = by_uuid[ordered_uuids[0]]
        # item：设计器单卡变量；items：批量循环。两者都提供，避免缺 for 时渲染报 item undefined
        return {
            "document_type": "equipment_card",
            "document_id": first.id,
            "code": first.code,
            "name": first.name,
            "card_title": "设备卡",
            "items": items,
            "item": items[0] if items else {},
        }

    async def _format_mold_cards_data(
        self,
        tenant_id: int,
        mold_uuids: list[str],
        i18n: PrintLocalization | None = None,
    ) -> Dict[str, Any]:
        """格式化模具卡打印变量（支持批量）。"""
        from apps.kuaizhizao.models.mold import Mold
        from core.services.qrcode.qrcode_service import QRCodeService

        loc = i18n or await PrintLocalization.for_tenant(tenant_id)
        ordered_uuids = [str(u).strip() for u in mold_uuids if str(u).strip()]
        if not ordered_uuids:
            raise ValidationError("请选择要打印的模具")

        rows = await Mold.filter(
            tenant_id=tenant_id,
            uuid__in=ordered_uuids,
            deleted_at__isnull=True,
        ).all()
        by_uuid = {str(m.uuid): m for m in rows}
        missing = [u for u in ordered_uuids if u not in by_uuid]
        if missing:
            raise NotFoundError(f"模具不存在: {missing[0]}")

        def _fmt_date(value: Any) -> str:
            if value is None or value == "":
                return ""
            if hasattr(value, "strftime"):
                return value.strftime("%Y-%m-%d")
            text = str(value).strip()
            return text[:10] if text else ""

        items: list[Dict[str, Any]] = []
        for uuid in ordered_uuids:
            mold = by_uuid[uuid]
            qr = QRCodeService.generate_mold_qrcode(
                mold_uuid=str(mold.uuid),
                mold_code=mold.code or "",
                mold_name=mold.name or "",
                size=3,
                border=1,
            )
            affiliation = (getattr(mold, "storage_location", None) or "").strip()
            items.append(
                {
                    "id": mold.id,
                    "uuid": str(mold.uuid),
                    "code": mold.code,
                    "name": mold.name,
                    "model": mold.model,
                    "type": mold.type,
                    "storage_location": getattr(mold, "storage_location", None),
                    "affiliation": affiliation,
                    "purchase_date": _fmt_date(mold.purchase_date),
                    "installation_date": _fmt_date(mold.installation_date),
                    "status": loc.document_status(mold.status) if mold.status else mold.status,
                    "qrcode_image": qr.get("qrcode_image") or "",
                }
            )

        first = by_uuid[ordered_uuids[0]]
        return {
            "document_type": "mold_card",
            "document_id": first.id,
            "code": first.code,
            "name": first.name,
            "card_title": "模具卡",
            "items": items,
            "item": items[0] if items else {},
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

