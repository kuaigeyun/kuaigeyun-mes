"""好力 GO 财务 — 数电发票 PDF 本地 OCR 明细识别（可选依赖 pymupdf + rapidocr）。"""

from __future__ import annotations

import re
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from io import BytesIO
from typing import Any

from apps.haoligo.utils.finance_decimal import normalize_unit_price_literal, unit_price_to_api_str

try:
    import fitz  # pymupdf

    PYMUPDF_AVAILABLE = True
except ImportError:
    fitz = None  # type: ignore[misc, assignment]
    PYMUPDF_AVAILABLE = False

try:
    from PIL import Image, ImageOps
    from rapidocr_onnxruntime import RapidOCR

    RAPIDOCR_AVAILABLE = True
except ImportError:
    Image = None  # type: ignore[misc, assignment]
    ImageOps = None  # type: ignore[misc, assignment]
    RapidOCR = None  # type: ignore[misc, assignment]
    RAPIDOCR_AVAILABLE = False

_OCR_RENDER_DPI = 300


def _y_bucket_for_dpi(dpi: int) -> int:
    return max(12, round(dpi / 16.7))


def _preprocess_ocr_image(image: Any) -> Any:
    """灰度 + 自动对比度，减轻小字号丢字（如 阻燃 → 燃）。"""
    if Image is None or ImageOps is None:
        return image
    gray = ImageOps.grayscale(image)
    enhanced = ImageOps.autocontrast(gray)
    return enhanced.convert("RGB")


def _fix_common_ocr_name_errors(name: str) -> str:
    """数电票项目名称常见 OCR 缺字/错字修正（仅高置信模式）。"""
    fixed = name.strip()
    if not fixed:
        return fixed
    if fixed.startswith("燃") and not fixed.startswith("阻燃"):
        fixed = re.sub(r"^燃(PA6|PBT|聚丙烯|尼龙)", r"阻燃\1", fixed)
    fixed = fixed.replace("饮性聚丙烯", "改性聚丙烯")
    if fixed.startswith("无卤燃") and not fixed.startswith("无卤阻燃"):
        fixed = "无卤阻燃" + fixed[len("无卤燃") :]
    return fixed

_UNIT_WORDS = frozenset(
    {
        "千克",
        "干克",
        "个",
        "件",
        "吨",
        "套",
        "米",
        "台",
        "批",
        "箱",
        "根",
        "卷",
        "张",
        "块",
        "支",
        "条",
        "包",
        "袋",
        "瓶",
        "桶",
        "片",
        "副",
        "只",
    }
)
_SPEC_CODE_RE = re.compile(r"^[\dA-Za-z][\dA-Za-z\-\.]{3,31}$")
_INVOICE_SPEC_SUFFIX_RE = re.compile(r"^(\d+度[\u4e00-\u9fffA-Za-z0-9\(\)（）]+)$")
_MERGED_NAME_SPEC_RE = re.compile(r"^(\*[^*]+\*.+?)(\d+度.+)$")
_TRAILING_DIGIT_SPEC_RE = re.compile(r"^(.+?)(\d{6,12})$")
_NUM_RE = re.compile(r"^[\d,]+(?:\.\d+)?$")
_PCT_RE = re.compile(r"^(\d+(?:\.\d+)?)%$")

# 数电票明细表头 → 列序（用于 OCR 坐标分列）
_DETAIL_COLUMN_KEYS: tuple[str, ...] = (
    "name",
    "spec",
    "unit",
    "quantity",
    "price",
    "amount",
    "tax_rate",
    "tax",
)
_DETAIL_HEADER_ALIASES: dict[str, tuple[str, ...]] = {
    "name": ("项目名称",),
    "spec": ("规格型号",),
    "unit": ("单位",),
    "quantity": ("数量",),
    "price": ("单价",),
    "amount": ("金额",),
    "tax_rate": ("税率/征收率", "税率", "征收率"),
    "tax": ("税额",),
}


def _price_literal_from_text(text: str | None, decimal: Decimal | None) -> str | None:
    if text:
        try:
            return normalize_unit_price_literal(text)
        except ValueError:
            pass
    if decimal is not None:
        return unit_price_to_api_str(decimal)
    return None


def _is_known_unit(text: str) -> bool:
    return text.strip() in _UNIT_WORDS


def _looks_like_invoice_spec(text: str) -> bool:
    """数电票规格型号：字母型号、纯数字编码、或「125度塑壳」类中文规格。"""
    text = text.strip()
    if not text or _is_known_unit(text) or _PCT_RE.match(text):
        return False
    if _INVOICE_SPEC_SUFFIX_RE.match(text):
        return True
    if _SPEC_CODE_RE.match(text.replace(",", "")):
        return True
    return _looks_like_spec(text)


def _looks_like_spec(text: str) -> bool:
    text = text.strip()
    if not text or _is_known_unit(text) or _PCT_RE.match(text):
        return False
    if re.search(r"[A-Za-z]", text):
        return True
    first = text.split()[0]
    return not _NUM_RE.match(first.replace(",", ""))


def _looks_like_spec_at(cells: list[str], idx: int) -> bool:
    """规格型号列：含字母型号，或纯数字物料编码且下一列为单位。"""
    if idx >= len(cells):
        return False
    text = cells[idx].strip()
    if not text:
        return False
    if _looks_like_spec(text):
        return True
    if idx + 1 < len(cells) and _is_known_unit(cells[idx + 1]):
        return bool(_SPEC_CODE_RE.match(text.replace(",", "")))
    return _looks_like_invoice_spec(text)


def _split_merged_name_and_spec(raw_name: str) -> tuple[str, str]:
    """项目名称列与规格型号粘连时，按「数字+度」等票面规格特征拆回两列。"""
    text = raw_name.strip()
    if not text:
        return text, ""
    m = _MERGED_NAME_SPEC_RE.match(text)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    m2 = re.match(r"^(.+?)(\d+度.+)$", text)
    if m2:
        name_part = m2.group(1).strip()
        spec_part = m2.group(2).strip()
        if len(name_part) >= 2 and _looks_like_invoice_spec(spec_part):
            return name_part, spec_part
    return text, ""


def _split_trailing_digit_spec(raw_name: str) -> tuple[str, str]:
    """项目名称列末尾粘连纯数字规格编码（如 橡胶圈13.6*071700003）。"""
    text = raw_name.strip()
    if not text or "*" not in text:
        return text, ""
    m = _TRAILING_DIGIT_SPEC_RE.match(text)
    if not m:
        return text, ""
    name_part, spec_part = m.group(1).strip(), m.group(2).strip()
    if len(name_part) < 2 or _NUM_RE.match(name_part.replace(",", "")):
        return text, ""
    if not _SPEC_CODE_RE.match(spec_part):
        return text, ""
    return name_part, spec_part


def _strip_tax_category_prefix(raw_name: str) -> str:
    """去掉 *大类* 前缀，便于判断名称/规格分界。"""
    text = raw_name.strip()
    m = re.match(r"\*[^*]+\*(.+)", text)
    return m.group(1).strip() if m and m.group(1).strip() else text


def _split_merged_name_spec_fallback(raw_name: str) -> tuple[str, str]:
    """
    规格列缺失时，从粘连的项目名称推断规格（兜底，按置信度依次尝试）。

    列坐标分列仍是主路径；此处仅处理 OCR 把两列合成一个文本框的情况。
    """
    text = raw_name.strip()
    if not text:
        return text, ""

    name, spec = _split_merged_name_and_spec(text)
    if spec:
        return name, spec

    name, spec = _split_trailing_digit_spec(text)
    if spec:
        return name, spec

    core = _strip_tax_category_prefix(text)
    if core != text:
        _, core_spec = _split_merged_name_and_spec(core)
        if not core_spec:
            _, core_spec = _split_trailing_digit_spec(f"*{core}")
        if core_spec:
            prefix = text[: len(text) - len(core)]
            return prefix + core[: len(core) - len(core_spec)].rstrip("*"), core_spec

    # 末尾字母数字规格：须高置信，避免误拆中文名称
    m = re.match(r"^(.+?)([A-Z0-9][A-Z0-9\-\./ ]{3,31})$", core)
    if m:
        name_part, spec_part = m.group(1).strip(), m.group(2).strip()
        if (
            len(name_part) >= 2
            and re.search(r"[A-Za-z]", spec_part)
            and re.search(r"\d", spec_part)
            and _looks_like_invoice_spec(spec_part)
            and not name_part.endswith("(")
        ):
            if text.startswith("*"):
                cat = re.match(r"(\*[^*]+\*)", text)
                prefix = cat.group(1) if cat else ""
                return f"{prefix}{name_part}", spec_part
            return name_part, spec_part

    return text, ""


def _spec_cell_trusted(spec: str) -> bool:
    """OCR 规格列单元格是否可信（仅过滤空值/单位/单字碎片；不做材质名硬编码）。"""
    text = str(spec or "").strip()
    if not text or _is_known_unit(text):
        return False
    if len(text) <= 2 and not _SPEC_CODE_RE.match(text.replace(",", "")):
        return False
    return bool(_looks_like_invoice_spec(text) or _looks_like_spec(text) or _SPEC_CODE_RE.match(text.replace(",", "")))


def _resolve_name_and_spec(raw_name: str, spec_cell: str | None) -> tuple[str, str]:
    """
    确定项目名称与规格型号。

    1. 规格列有独立 OCR 文本 → 直接采用（最稳定，与规格是数字/字母/中文无关）
    2. 规格列为空 → 文本兜底拆分
    """
    spec = str(spec_cell or "").strip()
    name = raw_name.strip()
    if _spec_cell_trusted(spec):
        return name, spec
    return _split_merged_name_spec_fallback(name)


def _layout_detail_row(cells: list[str]) -> list[str]:
    """补齐数电票明细固定列位：名称/规格/单位/数量/单价/金额/税率/税额。"""
    row = [str(c).strip() if c else "" for c in cells[:8]]
    while len(row) < 8:
        row.append("")
    return row


def _uses_layout_columns(cells: list[str]) -> bool:
    """是否按固定列位解析（分列 OCR 或已补齐的 layout 行）。"""
    if len(cells) < 3:
        return False
    col1 = str(cells[1]).strip()
    if not col1:
        return True
    if _looks_like_spec_at(cells, 1):
        return True
    return _is_known_unit(col1)


def _merge_layout_fragment(buf: list[str], frag: list[str]) -> list[str]:
    """将 OCR 续行片段按列位合并进上一行（规格/单位/金额尾段）。"""
    buf = _layout_detail_row(buf)
    tokens = [str(t).strip() for t in frag if t and str(t).strip()]
    if not tokens:
        return buf

    if len(tokens) == 1:
        tok = tokens[0]
        if _looks_like_invoice_spec(tok) and not _is_known_unit(tok):
            buf[1] = f"{buf[1]} {tok}".strip() if buf[1] else tok
            return buf
        if _is_known_unit(tok) and not buf[2]:
            buf[2] = tok
            return buf
        for col in range(3, 8):
            if not buf[col]:
                buf[col] = tok
                return buf
        return buf

    ti = 0
    while ti < len(tokens):
        tok = tokens[ti]
        placed = False
        if not buf[1] and _looks_like_spec_at(tokens, ti) and not _is_known_unit(tok):
            buf[1] = tok
            ti += 1
            placed = True
        elif not buf[2] and _is_known_unit(tok):
            buf[2] = tok
            ti += 1
            placed = True
        else:
            for col in range(3, 8):
                if not buf[col]:
                    buf[col] = tok
                    ti += 1
                    placed = True
                    break
        if not placed:
            ti += 1
    return buf


def ocr_available() -> bool:
    return PYMUPDF_AVAILABLE and RAPIDOCR_AVAILABLE


def _to_decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    try:
        return Decimal(value.replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None


def _material_code_from_ocr(name: str, spec: str) -> str:
    spec = spec.strip()
    if spec:
        return spec[:64]
    m = re.match(r"\*[^*]+\*(.+)", name.strip())
    if m and m.group(1).strip():
        return m.group(1).strip()[:64]
    return name.strip()[:64]


def _material_name_from_ocr(name: str) -> str:
    name = name.strip()
    m = re.match(r"\*[^*]+\*(.+)", name)
    if m and m.group(1).strip():
        rest = m.group(1).strip()
    else:
        rest = None
        for prefix in ("*塑料制品", "*化学合成材料", "*橡胶"):
            if name.startswith(prefix):
                rest = name[len(prefix) :].strip()
                break
        if rest is None:
            rest = name.lstrip("*").strip()
    return _fix_common_ocr_name_errors(rest)[:200]


def _is_pct(text: str) -> bool:
    return bool(_PCT_RE.match(text.replace("％", "%").strip()))


def _split_merged_qty_price(
    text: str, amount: Decimal | None = None
) -> tuple[Decimal | None, Decimal | None, str | None, str | None]:
    """数量与单价被 OCR 连成一串（如 3900014.6017…）时，用金额反推分界。"""
    text = text.strip().replace(",", "").replace(" ", "")
    if not text:
        return None, None, None, None

    spaced_qty, spaced_price = _split_qty_price(text)
    if spaced_qty is not None and spaced_price is not None:
        parts = text.split()
        if len(parts) >= 2:
            if amount is None or amount <= 0 or abs(spaced_qty * spaced_price - amount) / amount <= Decimal("0.002"):
                return spaced_qty, spaced_price, parts[0], parts[1]

    if amount is None or amount <= 0:
        single = _to_decimal(text)
        return single, None, text if single is not None else None, None

    best: tuple[Decimal, Decimal, str, str] | None = None
    best_err: Decimal | None = None
    for i in range(1, len(text)):
        left, right = text[:i], text[i:]
        if left.endswith(".") or right.startswith("."):
            continue
        if not _NUM_RE.match(left) or not _NUM_RE.match(right):
            continue
        qty = _to_decimal(left)
        price = _to_decimal(right)
        if qty is None or price is None or qty <= 0 or price <= 0:
            continue
        err = abs(qty * price - amount) / amount
        if err <= Decimal("0.002") and (best_err is None or err < best_err):
            best = (qty, price, left, right)
            best_err = err
    if best:
        return best[0], best[1], best[2], best[3]
    single = _to_decimal(text)
    return single, None, text if single is not None else None, None


def _decimal_places_from_text(text: str | None) -> int:
    if not text:
        return 0
    s = str(text).strip().replace(",", "")
    if "." not in s:
        return 0
    return len(s.split(".", 1)[1])


def _parse_tail_amount_fields(
    tail: list[str],
) -> tuple[list[str], Decimal | None, str | None, Decimal | None, str | None, str | None]:
    """从行尾解析 金额 / 税率 / 税额；返回 amount/tax 原文便于保留小数位。"""
    tail = [t.strip() for t in tail if t and str(t).strip()]
    if len(tail) < 2:
        return tail, None, None, None, "", ""

    pct_idx: int | None = None
    for i in range(len(tail) - 1, -1, -1):
        if _is_pct(tail[i]):
            pct_idx = i
            break

    if pct_idx is not None and pct_idx >= 1:
        amount_text = tail[pct_idx - 1]
        amount_num_text = amount_text.replace(",", "")
        if _NUM_RE.match(amount_num_text):
            amount = _to_decimal(amount_text)
            tax_rate_text = tail[pct_idx].replace("％", "%").strip()
            tax_text = ""
            tax_amount: Decimal | None = None
            if pct_idx + 1 < len(tail) and _NUM_RE.match(tail[pct_idx + 1].replace(",", "")):
                tax_text = tail[pct_idx + 1]
                tax_amount = _to_decimal(tax_text)
            before_amount = tail[: pct_idx - 1]
            return before_amount, amount, tax_rate_text, tax_amount, amount_text, tax_text

    amount_text = tail[-1]
    amount = _to_decimal(amount_text)
    return tail[:-1], amount, None, None, amount_text, ""


def _resolve_qty_and_unit_price(
    before_amount: list[str], amount: Decimal | None
) -> tuple[Decimal | None, Decimal | None, str | None, str | None]:
    if len(before_amount) >= 2:
        qty_text, price_text = before_amount[0], before_amount[1]
        qty = _to_decimal(qty_text)
        merged_qty, merged_price = _split_qty_price(price_text)
        price = merged_price if merged_price is not None else _to_decimal(price_text)
        if qty and price and amount and amount > 0 and abs(qty * price - amount) / amount <= Decimal("0.02"):
            return qty, price, qty_text, price_text
        split_qty, split_price, split_q_text, split_p_text = _split_merged_qty_price(before_amount[0], amount)
        if split_qty and split_price:
            return split_qty, split_price, split_q_text, split_p_text
        return qty, price, qty_text, price_text
    if len(before_amount) == 1:
        return _split_merged_qty_price(before_amount[0], amount)
    return None, None, None, None


def _split_qty_price(text: str) -> tuple[Decimal | None, Decimal | None]:
    text = text.strip().replace(",", "")
    parts = text.split()
    if len(parts) >= 2 and _NUM_RE.match(parts[0]) and _NUM_RE.match(parts[1]):
        return _to_decimal(parts[0]), _to_decimal(parts[1])
    if len(parts) == 1 and _NUM_RE.match(parts[0]):
        return _to_decimal(parts[0]), None
    return None, None


_SELLER_MARKERS = ("销售方", "销 售 方", "销货方", "销告方")
_BUYER_MARKERS = ("购买方", "购 买 方", "购货方")
_NAME_IN_TEXT_RE = re.compile(
    r"名称\s*[：:]\s*(.+?)(?=(?:统一社会信用代码|纳税人识别号|地址|电话|$))"
)
_COMPANY_NAME_RE = re.compile(r"(?:有限公司|股份有限公司|有限责任公司|集团公司|公司|工厂|厂)$")


def _normalize_party_marker(text: str) -> str:
    return text.replace(" ", "")


def _clean_company_name(text: str) -> str:
    name = re.sub(r"\s+", "", (text or "").strip())
    name = re.sub(r"(统一社会信用代码|纳税人识别号|地址|电话).*", "", name)
    return name.strip()


def _looks_like_company_name(name: str) -> bool:
    if len(name) < 4:
        return False
    return bool(_COMPANY_NAME_RE.search(name)) or len(name) >= 8


def _row_has_marker(row: list[str], markers: tuple[str, ...]) -> bool:
    joined = _normalize_party_marker(" ".join(row))
    return any(_normalize_party_marker(m) in joined for m in markers)


def _company_names_in_row(cells: list[str]) -> list[str]:
    out: list[str] = []
    normalized = [c.strip() for c in cells if c and str(c).strip()]
    for i, cell in enumerate(normalized):
        if cell.startswith("名称"):
            rest = re.sub(r"^名称\s*[：:]\s*", "", cell)
            if rest:
                name = _clean_company_name(rest)
                if _looks_like_company_name(name):
                    out.append(name)
            elif i + 1 < len(normalized):
                name = _clean_company_name(normalized[i + 1])
                if _looks_like_company_name(name):
                    out.append(name)
            continue
        if cell in ("名称", "名 称") and i + 1 < len(normalized):
            name = _clean_company_name(normalized[i + 1])
            if _looks_like_company_name(name):
                out.append(name)
        for n in _NAME_IN_TEXT_RE.findall(cell):
            name = _clean_company_name(n)
            if _looks_like_company_name(name):
                out.append(name)
    return out


def _is_invoice_table_end_row(cells: list[str]) -> bool:
    """明细表结束：价税合计，或末页带金额的合计行（分页续表中间的「合计」不算）。"""
    joined = " ".join(cells)
    if "价税合计" in joined:
        return True
    norm = _normalize_party_marker(joined)
    if "合计" not in norm:
        return False
    amount_cells = sum(
        1 for c in cells if c and _NUM_RE.match(str(c).replace(",", "").replace(" ", ""))
    )
    return amount_cells >= 1


def _is_detail_table_row(cells: list[str]) -> bool:
    joined = " ".join(cells)
    return "项目名称" in joined and ("规格型号" in joined or "单价" in joined)


def _row_window_text(rows: list[list[str]], idx: int, *, radius: int = 2) -> str:
    parts: list[str] = []
    for j in range(max(0, idx - radius), min(len(rows), idx + radius + 1)):
        parts.append(" ".join(rows[j]))
    return _normalize_party_marker(" ".join(parts))


def parse_seller_name_from_ocr_rows(rows: list[list[str]]) -> str | None:
    """数电票销售方（材料供应商）名称；票面布局购买方在左、销售方在右。"""
    # 明细表前：同一行两个「名称：…」→ 右列为销售方（OCR 最常见）
    for cells in rows:
        if _is_detail_table_row(cells):
            break
        names = _company_names_in_row(cells)
        if len(names) >= 2:
            return names[-1]

    # OCR 常把「购买方/销售方」拆成 购、销、售方 等多行
    for i, cells in enumerate(rows):
        if _is_detail_table_row(cells):
            break
        window = _row_window_text(rows, i, radius=3)
        has_buyer_seller_header = ("购" in window and ("销" in window or "售方" in window)) or (
            "购买方" in window and ("销售方" in window or "售方" in window)
        )
        if not has_buyer_seller_header:
            continue
        for j in range(i, min(i + 6, len(rows))):
            if _is_detail_table_row(rows[j]):
                break
            names = _company_names_in_row(rows[j])
            if len(names) >= 2:
                return names[-1]

    dual_header_idx: int | None = None
    seller_only_idx: int | None = None

    for i, cells in enumerate(rows):
        joined_norm = _normalize_party_marker(" ".join(cells))
        has_seller = "销售方" in joined_norm or "销货方" in joined_norm or joined_norm == "售方"
        has_buyer = "购买方" in joined_norm or "购货方" in joined_norm or joined_norm.startswith("购")
        if has_seller and has_buyer:
            dual_header_idx = i
        elif has_seller and not has_buyer:
            seller_only_idx = i

    if dual_header_idx is not None:
        for j in range(dual_header_idx + 1, min(dual_header_idx + 5, len(rows))):
            names = _company_names_in_row(rows[j])
            if len(names) >= 2:
                return names[-1]
            if len(names) == 1 and "购买方" not in " ".join(rows[j]):
                return names[0]

    if seller_only_idx is not None:
        for j in range(seller_only_idx + 1, min(seller_only_idx + 5, len(rows))):
            if _row_has_marker(rows[j], _BUYER_MARKERS):
                break
            names = _company_names_in_row(rows[j])
            for name in names:
                if _looks_like_company_name(name):
                    return name
            for cell in rows[j]:
                cleaned = _clean_company_name(cell)
                if _looks_like_company_name(cleaned) and "名称" not in cell:
                    return cleaned

    candidates: list[str] = []
    collecting = False
    for cells in rows:
        joined_norm = _normalize_party_marker(" ".join(cells))
        if _is_detail_table_row(cells):
            break
        if "销售方" in joined_norm or "销货方" in joined_norm or joined_norm == "售方":
            collecting = True
            candidates.extend(_company_names_in_row(cells))
            continue
        if collecting:
            if "购买方" in joined_norm and "销售方" not in joined_norm:
                continue
            candidates.extend(_company_names_in_row(cells))
            for cell in cells:
                cleaned = _clean_company_name(cell)
                if _looks_like_company_name(cleaned) and "名称" not in cell:
                    candidates.append(cleaned)
    if candidates:
        return candidates[-1]
    return None


def _normalize_header_token(text: str) -> str:
    return re.sub(r"\s+", "", (text or "").strip())


def _match_detail_header_key(text: str) -> str | None:
    norm = _normalize_header_token(text)
    if not norm:
        return None
    for key, aliases in _DETAIL_HEADER_ALIASES.items():
        for alias in aliases:
            if norm == _normalize_header_token(alias) or alias in text:
                return key
    return None


def _extract_detail_column_boundaries(
    ocr_result: list[Any], *, y_bucket: int
) -> list[float] | None:
    """从明细表头 OCR 框的 x 坐标推算列分界（数电票列宽固定）。"""
    by_y: dict[int, list[tuple[float, str]]] = defaultdict(list)
    for box, text, _score in ocr_result:
        if not text or not str(text).strip():
            continue
        y_center = sum(p[1] for p in box) / 4
        x_center = sum(p[0] for p in box) / 4
        y_key = round(y_center / y_bucket) * y_bucket
        by_y[y_key].append((x_center, str(text).strip()))

    for y_key in sorted(by_y):
        col_x: dict[str, float] = {}
        for x_center, token in by_y[y_key]:
            key = _match_detail_header_key(token)
            if key and key not in col_x:
                col_x[key] = x_center
        if "name" not in col_x:
            continue
        if "spec" not in col_x and "unit" not in col_x and "price" not in col_x:
            continue
        ordered_x = [col_x[k] for k in _DETAIL_COLUMN_KEYS if k in col_x]
        if len(ordered_x) < 2:
            continue
        return [(ordered_x[i] + ordered_x[i + 1]) / 2 for i in range(len(ordered_x) - 1)]
    return None


def _column_index_for_x(x: float, boundaries: list[float]) -> int:
    for idx, bound in enumerate(boundaries):
        if x < bound:
            return idx
    return len(boundaries)


def _column_index_for_box(x_left: float, x_center: float, boundaries: list[float]) -> int:
    """窄文本框优先按左边界落列，宽框跨列时仍归名称列以便文本兜底拆分。"""
    idx_left = _column_index_for_x(x_left, boundaries)
    idx_center = _column_index_for_x(x_center, boundaries)
    if idx_left != idx_center and idx_left == 0:
        return 0
    return idx_center


def _group_ocr_rows(
    ocr_result: list[Any],
    *,
    y_bucket: int = 15,
    column_boundaries: list[float] | None = None,
) -> list[list[str]]:
    """按 y 分行；若提供表头列界则按 x 落入固定列宽，避免项目名称与规格型号混为一格。"""
    if not column_boundaries:
        buckets: dict[int, list[tuple[float, str]]] = defaultdict(list)
        for box, text, _score in ocr_result:
            if not text or not str(text).strip():
                continue
            y_center = sum(p[1] for p in box) / 4
            x_left = min(p[0] for p in box)
            buckets[round(y_center / y_bucket) * y_bucket].append((x_left, str(text).strip()))
        rows: list[list[str]] = []
        for _y in sorted(buckets):
            cells = [t for _x, t in sorted(buckets[_y], key=lambda item: item[0])]
            if cells:
                rows.append(cells)
        return rows

    row_cols: dict[int, dict[int, list[tuple[float, str]]]] = defaultdict(lambda: defaultdict(list))
    num_cols = len(column_boundaries) + 1
    for box, text, _score in ocr_result:
        if not text or not str(text).strip():
            continue
        y_center = sum(p[1] for p in box) / 4
        x_center = sum(p[0] for p in box) / 4
        x_left = min(p[0] for p in box)
        y_key = round(y_center / y_bucket) * y_bucket
        col_idx = _column_index_for_box(x_left, x_center, column_boundaries)
        row_cols[y_key][col_idx].append((x_left, str(text).strip()))

    rows: list[list[str]] = []
    for _y in sorted(row_cols):
        cols = row_cols[_y]
        if not cols:
            continue
        cells: list[str] = []
        for col_idx in range(num_cols):
            parts = [t for _x, t in sorted(cols.get(col_idx, []), key=lambda item: item[0])]
            cells.append(" ".join(parts).strip())
        if any(c.strip() for c in cells):
            rows.append(cells)
    return rows


def _parse_invoice_detail_row(cells: list[str]) -> dict[str, Any] | None:
    if not cells or "*" not in cells[0]:
        return None
    if any(k in cells[0] for k in ("项目名称", "规格型号", "合计")):
        return None

    spec_cell = ""
    if len(cells) > 1 and _looks_like_spec_at(cells, 1):
        spec_cell = cells[1]
    name, spec = _resolve_name_and_spec(cells[0], spec_cell)

    idx = 1
    if spec_cell and _spec_cell_trusted(spec_cell):
        idx = 2
    elif not spec and len(cells) > 1 and _looks_like_spec_at(cells, 1):
        idx = 2

    while idx < len(cells) and not str(cells[idx]).strip():
        idx += 1

    unit: str | None = None
    if idx < len(cells) and _is_known_unit(cells[idx]):
        unit = "千克" if cells[idx] == "干克" else cells[idx]
        idx += 1

    tail = cells[idx:]
    before_amount, amount, tax_rate_text, tax_amount, amount_text, tax_text = _parse_tail_amount_fields(tail)
    if amount is None:
        return None

    quantity, unit_price, qty_text, price_text = _resolve_qty_and_unit_price(before_amount, amount)
    if quantity is None or unit_price is None:
        return None

    if amount > 0 and abs(quantity * unit_price - amount) / amount > Decimal("0.02"):
        retry_qty, retry_price, retry_q_text, retry_p_text = _split_merged_qty_price("".join(before_amount), amount)
        if retry_qty and retry_price:
            quantity, unit_price = retry_qty, retry_price
            qty_text, price_text = retry_q_text, retry_p_text

    material_name = _material_name_from_ocr(name)
    if not material_name:
        return None

    price_literal = _price_literal_from_text(price_text, unit_price)

    return {
        "material_code": _material_code_from_ocr(name, spec),
        "material_name": material_name,
        "spec": spec or None,
        "unit": unit,
        "quantity": quantity,
        "invoice_unit_price": unit_price,
        "invoice_unit_price_literal": price_literal,
        "line_amount": amount,
        "tax_amount": tax_amount,
        "tax_rate_text": tax_rate_text,
        "quantity_decimals": _decimal_places_from_text(qty_text),
        "invoice_unit_price_decimals": _decimal_places_from_text(price_text),
        "line_amount_decimals": _decimal_places_from_text(amount_text),
        "tax_amount_decimals": _decimal_places_from_text(tax_text),
    }


def _merge_split_ocr_table_rows(rows: list[list[str]]) -> list[list[str]]:
    """OCR 常把同一明细行拆成多段；仅在表格区域内合并，且合并到可解析即停。"""
    merged: list[list[str]] = []
    in_table = False
    i = 0
    while i < len(rows):
        cells = rows[i]
        joined = " ".join(cells)
        if "项目名称" in joined and "规格型号" in joined:
            in_table = True
            merged.append(cells)
            i += 1
            continue
        if not in_table:
            i += 1
            continue
        if _is_invoice_table_end_row(cells):
            merged.append(cells)
            break
        if cells and "*" in cells[0]:
            buf = list(cells)
            j = i + 1
            while j < len(rows):
                nxt = rows[j]
                if _is_invoice_table_end_row(nxt):
                    break
                if nxt and "*" in nxt[0]:
                    break
                if _parse_invoice_detail_row(buf):
                    break
                trial = buf + nxt
                if _parse_invoice_detail_row(trial):
                    buf = trial
                    j += 1
                    break
                buf = trial
                j += 1
            merged.append(buf)
            i = j if j > i else i + 1
        else:
            i += 1
    return merged


def parse_invoice_lines_from_ocr_rows(rows: list[list[str]]) -> list[dict[str, Any]]:
    rows = _merge_split_ocr_table_rows(rows)
    lines: list[dict[str, Any]] = []
    in_table = False
    for cells in rows:
        joined = " ".join(cells)
        if "项目名称" in joined and "规格型号" in joined:
            in_table = True
            continue
        if not in_table:
            continue
        if _is_invoice_table_end_row(cells):
            break
        parsed = _parse_invoice_detail_row(cells)
        if parsed:
            parsed["line_no"] = len(lines) + 1
            lines.append(parsed)
    return lines


def _render_pdf_page(pdf_bytes: bytes, page_index: int, *, dpi: int = _OCR_RENDER_DPI) -> Any:
    if not PYMUPDF_AVAILABLE or fitz is None:
        raise RuntimeError("pymupdf 未安装")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if doc.page_count < 1:
            raise ValueError("PDF 无页面")
        if page_index < 0 or page_index >= doc.page_count:
            raise ValueError("PDF 页码无效")
        page = doc[page_index]
        matrix = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        if Image is None:
            raise RuntimeError("Pillow 未安装")
        return Image.open(BytesIO(pix.tobytes("png")))
    finally:
        doc.close()


def _render_pdf_first_page(pdf_bytes: bytes, *, dpi: int = _OCR_RENDER_DPI) -> Any:
    return _render_pdf_page(pdf_bytes, 0, dpi=dpi)


def _ocr_image_rows(
    image: Any,
    *,
    dpi: int,
    column_boundaries: list[float] | None = None,
) -> tuple[list[list[str]], list[float] | None]:
    if RapidOCR is None:
        return [], column_boundaries
    y_bucket = _y_bucket_for_dpi(dpi)
    ocr = RapidOCR()
    result, _ = ocr(image)
    if not result:
        return [], column_boundaries
    bounds = _extract_detail_column_boundaries(result, y_bucket=y_bucket)
    # 平铺分行 + 续行合并更稳；列界仅用于诊断/后续增强，不参与主路径
    rows = _group_ocr_rows(result, y_bucket=y_bucket, column_boundaries=None)
    return rows, bounds


def _is_detail_table_header_row(cells: list[str]) -> bool:
    joined = " ".join(cells)
    return "项目名称" in joined and ("规格型号" in joined or "单价" in joined)


def _ocr_pdf_all_pages_rows(pdf_bytes: bytes) -> list[list[str]]:
    """PDF 全部页面 OCR → 按行分组；首页表头定列宽，多页续表合并。"""
    if not ocr_available() or fitz is None:
        return []
    dpi = _OCR_RENDER_DPI
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page_count = doc.page_count
    finally:
        doc.close()
    if page_count < 1:
        return []

    all_rows: list[list[str]] = []
    column_boundaries: list[float] | None = None
    for page_index in range(page_count):
        image = _preprocess_ocr_image(_render_pdf_page(pdf_bytes, page_index, dpi=dpi))
        page_rows, column_boundaries = _ocr_image_rows(
            image, dpi=dpi, column_boundaries=column_boundaries
        )
        for cells in page_rows:
            if page_index > 0 and _is_detail_table_header_row(cells):
                continue
            all_rows.append(cells)
    return all_rows


def _ocr_pdf_first_page_rows(pdf_bytes: bytes) -> list[list[str]]:
    """PDF 第一页 OCR → 按行分组的文本单元格（用于销售方等页头信息）。"""
    if not ocr_available() or RapidOCR is None:
        return []
    dpi = _OCR_RENDER_DPI
    image = _preprocess_ocr_image(_render_pdf_first_page(pdf_bytes, dpi=dpi))
    rows, _ = _ocr_image_rows(image, dpi=dpi)
    return rows


def extract_invoice_lines_from_pdf_bytes(pdf_bytes: bytes) -> list[dict[str, Any]]:
    """PDF 全部页面 OCR → 数电票明细行（本地，无第三方云 API）。"""
    rows = _ocr_pdf_all_pages_rows(pdf_bytes)
    if not rows:
        return []
    return parse_invoice_lines_from_ocr_rows(rows)


def extract_seller_name_from_pdf_ocr(pdf_bytes: bytes) -> str | None:
    """PDF 第一页 OCR → 销售方（材料供应商）名称。"""
    rows = _ocr_pdf_first_page_rows(pdf_bytes)
    if not rows:
        return None
    return parse_seller_name_from_ocr_rows(rows)
