"""好力 GO 财务 — 数电发票 QR/PDF 解析（可插拔，测试样本驱动）。"""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from apps.haoligo.utils.finance_decimal import parse_unit_price_decimal, resolve_unit_price_literal
from io import BytesIO
from typing import Any

from fastapi import HTTPException, status

try:
    from PIL import Image
    from pyzbar.pyzbar import decode as pyzbar_decode

    PYZBAR_AVAILABLE = True
except (ImportError, OSError):
    Image = None  # type: ignore[misc, assignment]
    pyzbar_decode = None
    PYZBAR_AVAILABLE = False

try:
    from pypdf import PdfReader

    PYPDF_AVAILABLE = True
except ImportError:
    PdfReader = None  # type: ignore[misc, assignment]
    PYPDF_AVAILABLE = False


def _parse_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value).strip().replace(",", ""))
    except (InvalidOperation, ValueError):
        return None


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


def _normalize_line(raw: dict[str, Any], idx: int) -> dict[str, Any]:
    code = str(raw.get("material_code") or raw.get("item_code") or raw.get("code") or "").strip()
    name = str(raw.get("material_name") or raw.get("item_name") or raw.get("name") or "").strip()
    if not code or not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"明细第 {idx} 行缺少物料编码或名称",
        )
    qty = _parse_decimal(raw.get("quantity") or raw.get("qty") or 0) or Decimal("0")
    price_raw = raw.get("invoice_unit_price") or raw.get("unit_price") or raw.get("price")
    price_literal = raw.get("invoice_unit_price_literal")
    if isinstance(price_raw, str) and not price_literal:
        price_literal = price_raw.strip().replace(",", "")
    price = parse_unit_price_decimal(price_literal or price_raw) if price_raw is not None else None
    if price is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"明细第 {idx} 行缺少单价",
        )
    return {
        "line_no": int(raw.get("line_no") or idx),
        "material_code": code,
        "material_name": name,
        "spec": str(raw.get("spec") or raw.get("specification") or "").strip() or None,
        "unit": str(raw.get("unit") or "").strip() or None,
        "quantity": qty,
        "invoice_unit_price": price,
        "invoice_unit_price_literal": resolve_unit_price_literal(price, str(price_literal) if price_literal else None),
        "tax_amount": _parse_decimal(raw.get("tax_amount")),
    }


def parse_china_einvoice_qr_csv(text: str) -> dict[str, Any]:
    """
    解析国家标准数电发票 QR 逗号串。

    示例：01,31,,26442000004359167806,1705400.00,20260421,,8EEF
    字段：版本,票种,发票代码,发票号码,价税合计,开票日期,校验码,随机码
    """
    parts = [p.strip() for p in text.split(",")]
    if len(parts) < 4 or parts[0] != "01":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="不是可识别的数电发票 QR 格式",
        )
    invoice_no = parts[3]
    if not invoice_no:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="发票号码不能为空")
    invoice_code = parts[2] or None
    total_amount = _parse_decimal(parts[4]) if len(parts) > 4 else None
    invoice_date = _parse_date(parts[5]) if len(parts) > 5 and parts[5] else None
    return {
        "invoice_no": invoice_no,
        "invoice_code": invoice_code,
        "invoice_date": invoice_date,
        "total_amount": total_amount,
        "lines": [],
        "needs_lines": True,
        "parse_source": "einvoice_qr_csv",
        "qr_raw_text": text,
    }


def parse_structured_invoice_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """解析前端/集成方传入的结构化 JSON（手工录入或已解析结果）。"""
    invoice_no = str(payload.get("invoice_no") or "").strip()
    if not invoice_no:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="发票号码不能为空")
    lines_raw = payload.get("lines") or payload.get("items") or []
    if not isinstance(lines_raw, list) or not lines_raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="发票明细不能为空")
    lines = [_normalize_line(item if isinstance(item, dict) else {}, i + 1) for i, item in enumerate(lines_raw)]
    total = _parse_decimal(payload.get("total_amount"))
    if total is None:
        total = sum((ln["quantity"] * ln["invoice_unit_price"] for ln in lines), Decimal("0"))
    return {
        "invoice_no": invoice_no,
        "invoice_code": str(payload.get("invoice_code") or "").strip() or None,
        "invoice_date": _parse_date(payload.get("invoice_date")),
        "total_amount": total,
        "lines": lines,
        "needs_lines": False,
        "parse_source": "structured",
    }


def invoice_snapshot_for_json(value: Any) -> Any:
    """将解析结果转为 JSONField 可序列化结构（date/Decimal → 字符串）。"""
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, dict):
        return {str(k): invoice_snapshot_for_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [invoice_snapshot_for_json(v) for v in value]
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _decode_qr_texts_from_image_bytes(image_bytes: bytes) -> list[str]:
    if not PYZBAR_AVAILABLE or Image is None or pyzbar_decode is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="二维码解析不可用，请确认已安装 pyzbar 及 zbar 运行库",
        )
    try:
        image = Image.open(BytesIO(image_bytes))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF 内嵌图片无法读取",
        ) from e
    decoded = pyzbar_decode(image)
    return [obj.data.decode("utf-8") for obj in decoded if obj.data]


def extract_qr_texts_from_pdf_bytes(pdf_bytes: bytes) -> list[str]:
    """从 PDF 内嵌图片中提取数电发票 QR 文本（去重保序）。"""
    if not PYPDF_AVAILABLE or PdfReader is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF 解析依赖未安装，请在后端执行 uv sync",
        )
    if not pdf_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不是有效的 PDF 文件")
    reader = PdfReader(BytesIO(pdf_bytes))
    found: list[str] = []
    seen: set[str] = set()
    for page in reader.pages:
        images = getattr(page, "images", None)
        if not images:
            continue
        for img in images:
            for qr_text in _decode_qr_texts_from_image_bytes(img.data):
                if qr_text not in seen:
                    seen.add(qr_text)
                    found.append(qr_text)
    return found


def extract_seller_name_from_pdf_text(pdf_bytes: bytes) -> str | None:
    """从 PDF 文本层提取销售方（材料供应商）名称。"""
    if not PYPDF_AVAILABLE or PdfReader is None:
        return None
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        if not reader.pages:
            return None
        text = reader.pages[0].extract_text() or ""
    except Exception:
        return None
    if not text.strip():
        return None

    from apps.haoligo.services.finance_einvoice_ocr import (
        _clean_company_name,
        _looks_like_company_name,
    )

    text_norm = text.replace("\u3000", " ")
    if "销售方" in text_norm:
        seller_part = text_norm.split("销售方", 1)[1]
        match = re.search(
            r"名称\s*[：:]\s*(.+?)(?:\n|统一社会信用代码|纳税人识别号|地址|电话|开户)",
            seller_part,
        )
        if match:
            name = _clean_company_name(match.group(1))
            if _looks_like_company_name(name):
                return name

    all_names = re.findall(
        r"名称\s*[：:]\s*(.+?)(?:\n|统一社会信用代码|纳税人识别号|地址|电话|开户)",
        text_norm,
    )
    cleaned = [_clean_company_name(n) for n in all_names]
    cleaned = [n for n in cleaned if _looks_like_company_name(n)]
    if len(cleaned) >= 2:
        return cleaned[1]
    if len(cleaned) == 1 and "销售方" in text_norm:
        return cleaned[0]
    return None


def parse_einvoice_pdf_bytes(pdf_bytes: bytes) -> dict[str, Any]:
    """上传 PDF → 提取 QR；优先文本层解析明细，无文本层时回退 OCR。"""
    from apps.haoligo.services.finance_einvoice_ocr import (
        _ocr_pdf_all_pages_rows,
        _ocr_pdf_first_page_rows,
        ocr_available,
        parse_invoice_lines_from_ocr_rows,
        parse_seller_name_from_ocr_rows,
    )
    from apps.haoligo.services.finance_einvoice_pdf_text import (
        extract_invoice_lines_from_pdf_text_layer,
        extract_seller_name_from_pdf_text_layer,
        pdf_has_detail_text_layer,
        pdf_text_layer_available,
    )

    if not pdf_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF 文件为空")
    qr_texts = extract_qr_texts_from_pdf_bytes(pdf_bytes)
    if not qr_texts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="PDF 中未识别到数电发票二维码，请改用手工录入或粘贴 QR 文本",
        )
    parsed = parse_einvoice_qr_text(qr_texts[0])
    parsed["qr_raw_text"] = qr_texts[0]
    if len(qr_texts) > 1:
        parsed["alternate_qr_texts"] = qr_texts[1:]

    seller_name = extract_seller_name_from_pdf_text(pdf_bytes)
    if not seller_name and pdf_text_layer_available():
        seller_name = extract_seller_name_from_pdf_text_layer(pdf_bytes)
    if not seller_name and ocr_available():
        ocr_header_rows = _ocr_pdf_first_page_rows(pdf_bytes)
        if ocr_header_rows:
            seller_name = parse_seller_name_from_ocr_rows(ocr_header_rows)
    if seller_name:
        parsed["supplier_name"] = seller_name

    text_lines: list[dict[str, Any]] = []
    if pdf_text_layer_available() and pdf_has_detail_text_layer(pdf_bytes):
        text_lines = extract_invoice_lines_from_pdf_text_layer(pdf_bytes)

    ocr_lines: list[dict[str, Any]] = []
    if not text_lines and ocr_available():
        ocr_rows = _ocr_pdf_all_pages_rows(pdf_bytes)
        if ocr_rows:
            ocr_lines = parse_invoice_lines_from_ocr_rows(ocr_rows)

    if text_lines:
        parsed["lines"] = text_lines
        parsed["needs_lines"] = False
        parsed["parse_source"] = "pdf_qr_text"
    elif ocr_lines:
        parsed["lines"] = ocr_lines
        parsed["needs_lines"] = False
        parsed["parse_source"] = "pdf_qr_ocr"
    else:
        parsed["needs_lines"] = True
        parsed["parse_source"] = "pdf_qr"
        if pdf_text_layer_available() or ocr_available():
            parsed["line_parse_hint"] = "未能从 PDF 识别明细，请手工录入"
        else:
            parsed["line_parse_hint"] = "后端未安装 PDF 文本/OCR 依赖（uv sync --extra ocr），明细请手工录入"
    return parsed


def parse_einvoice_qr_text(qr_text: str) -> dict[str, Any]:
    """
    数电发票 QR 解析。

    支持：
    1. 完整 JSON（含 lines/items）
    2. 国家标准 CSV：01,票种,发票代码,发票号码,价税合计,开票日期,...
    3. 简易 CSV：发票号码,发票代码,开票日期,价税合计（仅头信息）
    """
    text = (qr_text or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="QR 内容不能为空")

    if text.startswith("{") or text.startswith("["):
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="QR JSON 格式无效") from e
        if isinstance(data, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="QR JSON 须为对象；明细请放在 lines 数组中",
            )
        return parse_structured_invoice_payload(data)

    if text.startswith("01,"):
        return parse_china_einvoice_qr_csv(text)

    parts = [p.strip() for p in re.split(r"[,，|]", text) if p.strip()]
    if len(parts) >= 4:
        return {
            "invoice_no": parts[0],
            "invoice_code": parts[1] or None,
            "invoice_date": _parse_date(parts[2]),
            "total_amount": _parse_decimal(parts[3]),
            "lines": [],
            "needs_lines": True,
            "parse_source": "qr_header_csv",
            "qr_raw_text": text,
        }

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="无法识别发票 QR 格式，请上传 PDF、粘贴数电 QR 或完整 JSON",
    )
