"""好力 GO 财务 — 数电发票 PDF 文本层明细解析（优先于 OCR）。

识别策略（不依赖材质/规格文案硬编码）：
1. 表头各列 x 坐标为锚点，词元按 x 落列（名称区 = x < 规格型号列锚点）
2. 同一明细项可占多行 y，遇金额列有值则收束为一行
3. OCR 仅在无文本层时启用
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

try:
    import fitz  # pymupdf

    PYMUPDF_AVAILABLE = True
except ImportError:
    fitz = None  # type: ignore[misc, assignment]
    PYMUPDF_AVAILABLE = False

from apps.haoligo.services.finance_einvoice_ocr import (
    _DETAIL_COLUMN_KEYS,
    _is_detail_table_header_row,
    _is_invoice_table_end_row,
    _layout_detail_row,
    _match_detail_header_key,
    _parse_invoice_detail_row,
    parse_seller_name_from_ocr_rows,
)

# 名称列与规格列之间常有折行（13.6* / NBR- 等），以「规格型号」表头 x 为界，而非列中点
_NAME_SPEC_GAP_PT = 8.0
_FIELD_ORDER = ("name", "spec", "unit", "quantity", "price", "amount", "tax_rate", "tax")
_Y_TOL = 2.0


def pdf_text_layer_available() -> bool:
    return PYMUPDF_AVAILABLE


def pdf_has_detail_text_layer(pdf_bytes: bytes) -> bool:
    if not PYMUPDF_AVAILABLE or fitz is None or not pdf_bytes.startswith(b"%PDF"):
        return False
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return False
    try:
        for page in doc:
            text = page.get_text("text") or ""
            if "项目名称" in text and re.search(r"\*[^\*\n]{1,32}\*", text):
                return True
        return False
    finally:
        doc.close()


def _header_y_from_words(words: list[tuple]) -> float | None:
    for w in words:
        if str(w[4]).replace(" ", "") == "项目名称":
            return float(w[1])
    return None


def _column_anchors_from_words(words: list[tuple]) -> dict[str, float] | None:
    """表头各列左边界 x（数电票列宽固定）。"""
    header_y = _header_y_from_words(words)
    if header_y is None:
        return None
    tol = 5.0
    hdr = [w for w in words if abs(float(w[1]) - header_y) <= tol]
    singles = sorted(
        (w for w in hdr if str(w[4]).replace(" ", "") == "单"),
        key=lambda w: float(w[0]),
    )
    anchors: dict[str, float] = {}
    for w in hdr:
        t = str(w[4])
        tn = t.replace(" ", "")
        key = _match_detail_header_key(t)
        if key == "name":
            anchors["name"] = float(w[0])
        elif key == "spec":
            anchors["spec"] = float(w[0])
        elif key == "quantity" or tn == "数":
            anchors.setdefault("quantity", float(w[0]))
        elif key == "amount" or tn == "金":
            anchors.setdefault("amount", float(w[0]))
        elif key == "tax_rate" or "税率" in t:
            anchors.setdefault("tax_rate", float(w[0]))
        elif key == "tax" or (tn == "税" and float(w[0]) > 500):
            anchors.setdefault("tax", float(w[0]))
    if len(singles) >= 2:
        anchors["unit"] = float(singles[0][0])
        anchors["price"] = float(singles[1][0])
    elif len(singles) == 1:
        anchors["unit"] = float(singles[0][0])
    if "name" not in anchors or "spec" not in anchors:
        return None
    return anchors


def _field_for_x(x: float, anchors: dict[str, float]) -> str:
    """按表头锚点落列；名称区含折行溢出（x 小于规格型号列）。"""
    spec_x = anchors["spec"]
    ordered = [(k, anchors[k]) for k in _FIELD_ORDER if k in anchors]
    if x < spec_x - _NAME_SPEC_GAP_PT:
        return "name"
    thresholds: list[tuple[str, float]] = []
    for i in range(len(ordered) - 1):
        left_k, left_x = ordered[i]
        right_x = ordered[i + 1][1]
        if left_k == "name":
            continue
        thresholds.append((ordered[i + 1][0], (left_x + right_x) / 2))
    field = "spec"
    for key, bound in thresholds:
        if x >= bound:
            field = key
        else:
            break
    if field == "spec" and x < spec_x - _NAME_SPEC_GAP_PT:
        return "name"
    return field


def _join_field_tokens(
    tokens: list[tuple[float, float, str, str]], *, name_field: bool
) -> str:
    if not tokens:
        return ""
    if name_field:
        order = {"amount": 0, "pre": 1, "post": 2}
        ordered = [
            t
            for _y, _x, t, src in sorted(
                tokens, key=lambda item: (order.get(item[3], 1), item[0], item[1])
            )
        ]
        return "".join(ordered)
    ordered = [t for _y, _x, t, _src in sorted(tokens, key=lambda item: (item[0], item[1]))]
    # 中文规格折行（剥线 + 头）直接拼接；含拉丁字母时保留空格
    if not any(re.search(r"[A-Za-z]", t) for t in ordered):
        return "".join(ordered)
    return " ".join(ordered)


class _DetailItemBuf:
    __slots__ = ("fields",)

    def __init__(self) -> None:
        self.fields: dict[str, list[tuple[float, float, str, str]]] = defaultdict(list)

    def absorb_band(
        self,
        band: dict[str, list[tuple[float, float, str]]],
        *,
        name_source: str = "amount",
    ) -> None:
        for key, tokens in band.items():
            if key == "name":
                self.fields[key].extend((y, x, t, name_source) for y, x, t in tokens)
            else:
                self.fields[key].extend((y, x, t, "amount") for y, x, t in tokens)

    def has_amount(self) -> bool:
        return bool(self.fields.get("amount"))

    def to_cells(self) -> list[str]:
        row = _layout_detail_row([])
        row[0] = _join_field_tokens(self.fields.get("name", []), name_field=True)
        row[1] = _join_field_tokens(self.fields.get("spec", []), name_field=False)
        row[2] = _join_field_tokens(self.fields.get("unit", []), name_field=False)
        row[3] = _join_field_tokens(self.fields.get("quantity", []), name_field=False)
        row[4] = _join_field_tokens(self.fields.get("price", []), name_field=False)
        row[5] = _join_field_tokens(self.fields.get("amount", []), name_field=False)
        row[6] = _join_field_tokens(self.fields.get("tax_rate", []), name_field=False)
        row[7] = _join_field_tokens(self.fields.get("tax", []), name_field=False)
        return row


def _band_words_to_fields(
    band_words: list[tuple], y_key: float, anchors: dict[str, float]
) -> dict[str, list[tuple[float, float, str]]]:
    out: dict[str, list[tuple[float, float, str]]] = defaultdict(list)
    for w in band_words:
        text = str(w[4]).strip()
        if not text:
            continue
        x0 = float(w[0])
        field = _field_for_x(x0, anchors)
        out[field].append((y_key, x0, text))
    return out


def _band_name_text_from_tokens(tokens: list[tuple[float, float, str]]) -> str:
    ordered = [t for _y, _x, t in sorted(tokens, key=lambda item: (item[0], item[1]))]
    return "".join(ordered)


def _has_category_prefix(name_text: str) -> bool:
    return bool(re.search(r"\*[^\*\n]{1,32}\*", name_text))


def _band_name_text(band: dict[str, list[tuple[float, float, str]]]) -> str:
    return _band_name_text_from_tokens(band.get("name", []))


def _band_is_name_only(band: dict[str, list[tuple[float, float, str]]]) -> bool:
    if band.get("amount") or band.get("quantity") or band.get("price"):
        return False
    if band.get("spec") or band.get("unit"):
        return False
    return bool(band.get("name"))


def _band_is_wrap_continuation(band: dict[str, list[tuple[float, float, str]]]) -> bool:
    """同一明细项折行续段：无数量/单价/金额，且非下一行 *大类* 名称开头。"""
    if band.get("amount") or band.get("quantity") or band.get("price"):
        return False
    if band.get("tax_rate") or band.get("tax"):
        return False
    name = _band_name_text(band)
    if _has_category_prefix(name):
        return False
    return bool(band.get("name") or band.get("spec") or band.get("unit"))


def _band_has_amount(band: dict[str, list[tuple[float, float, str]]]) -> bool:
    return bool(band.get("amount"))


def _band_amount_text(band: dict[str, list[tuple[float, float, str]]]) -> str:
    tokens = band.get("amount", [])
    ordered = [t for _y, _x, t in sorted(tokens, key=lambda item: (item[0], item[1]))]
    return " ".join(ordered)


def _is_footer_amount_band(band: dict[str, list[tuple[float, float, str]]]) -> bool:
    """页脚小计/合计行的 ¥ 金额列，不是明细项锚点。"""
    if not _band_has_amount(band):
        return False
    if band.get("spec") or _band_name_text(band).strip():
        return False
    return "¥" in _band_amount_text(band)


def _is_detail_amount_band(band: dict[str, list[tuple[float, float, str]]]) -> bool:
    if not _band_has_amount(band):
        return False
    if _is_footer_amount_band(band):
        return False
    if band.get("spec"):
        return True
    if _has_category_prefix(_band_name_text(band)):
        return True
    return bool(_band_name_text(band).strip())


def _attach_pre_name_band(
    page: int,
    y: float,
    page_prev: int,
    y_prev_amount: float,
    page_cur: int,
    y_cur_amount: float,
    *,
    cur_amount_orphan: bool,
    name_text: str,
) -> bool:
    if _has_category_prefix(name_text):
        return True
    if not cur_amount_orphan:
        return False
    if page != page_cur:
        return page > page_prev
    dist_prev = y - y_prev_amount
    dist_cur = y_cur_amount - y
    return dist_cur <= dist_prev


def _attach_post_name_band(
    page: int,
    y: float,
    page_cur: int,
    y_cur_amount: float,
    page_next: int,
    y_next_amount: float,
    *,
    next_amount_orphan: bool,
    name_text: str,
) -> bool:
    if _has_category_prefix(name_text):
        return False
    if page > page_cur:
        return True
    if page != page_next:
        return False
    # 下一金额行自带名称（非 orphan）：中间折行是上一项名称续行（如 13.6* 下一行的 1）
    if not next_amount_orphan:
        return True
    dist_cur = y - y_cur_amount
    dist_next = y_next_amount - y
    return dist_cur <= dist_next


_LEADING_NAME_WRAP_RE = re.compile(r"^([^*]{1,8})(\*[^*]{1,32}\*.+)$")
# 上一行规格末字与本行规格同 y 粘连：头140度… / 头 140度…
_LEADING_SPEC_WRAP_RE = re.compile(r"^([\u4e00-\u9fff]{1,3})(?:\s+|　)?(?=\d)")


def _peel_leading_name_wrap(name: str) -> tuple[str, str]:
    """金额行名称若以折行残片开头再接 *大类*，拆出残片归上一行。"""
    m = _LEADING_NAME_WRAP_RE.match((name or "").strip())
    if not m:
        return "", name or ""
    frag, rest = m.group(1), m.group(2)
    if _has_category_prefix(frag):
        return "", name or ""
    return frag, rest


def _peel_leading_spec_wrap(spec: str) -> tuple[str, str]:
    """规格列若以短中文残片开头且后接数字规格，拆出残片归上一行。"""
    s = (spec or "").strip()
    m = _LEADING_SPEC_WRAP_RE.match(s)
    if not m:
        return "", s
    frag = m.group(1)
    rest = s[m.end() :].strip()
    if not rest:
        return "", s
    return frag, rest


def _redistribute_y_merged_wrap_fragments(items: list[list[str]]) -> list[list[str]]:
    """纠正折行末字与下一金额行同 y 粘连（器*家用… / 头 140度…）。"""
    if len(items) < 2:
        return items
    for i in range(1, len(items)):
        prev, cur = items[i - 1], items[i]
        name_frag, name_rest = _peel_leading_name_wrap(cur[0])
        if name_frag:
            prev[0] = f"{prev[0]}{name_frag}"
            cur[0] = name_rest
        spec_frag, spec_rest = _peel_leading_spec_wrap(cur[1])
        if spec_frag:
            prev[1] = f"{(prev[1] or '').rstrip()}{spec_frag}".strip()
            cur[1] = spec_rest
    return items


def _detail_items_from_page_words(
    words: list[tuple],
    anchors: dict[str, float],
    *,
    header_y: float,
    page_no: int = 0,
) -> list[tuple[int, float, dict[str, list[tuple[float, float, str]]]]]:
    """返回 (page_no, y_key, band) 列表，供跨页按金额锚点组项。"""
    detail_words = [
        w
        for w in words
        if float(w[1]) > header_y + 4
        and not str(w[4]).startswith("共")
        and str(w[4]).replace(" ", "") not in ("小", "计", "合", "价税合计（大写）", "（小写）")
    ]
    by_y: dict[float, list[tuple]] = defaultdict(list)
    for w in detail_words:
        y_key = round(float(w[1]) / _Y_TOL) * _Y_TOL
        by_y[y_key].append(w)

    bands: list[tuple[int, float, dict[str, list[tuple[float, float, str]]]]] = []
    for y_key in sorted(by_y):
        band = _band_words_to_fields(by_y[y_key], y_key, anchors)
        if not any(band.values()):
            continue
        if _is_footer_band(band) or _is_footer_amount_band(band):
            break
        bands.append((page_no, y_key, band))
    return bands


def _group_bands_into_items(
    bands: list[tuple[int, float, dict[str, list[tuple[float, float, str]]]]],
) -> list[list[str]]:
    amount_indices = [
        i for i, (_p, _y, band) in enumerate(bands) if _is_detail_amount_band(band)
    ]
    if not amount_indices:
        return []

    items: list[list[str]] = []
    for k, idx in enumerate(amount_indices):
        page_a, y_a, amount_band = bands[idx]
        idx_prev = amount_indices[k - 1] if k > 0 else None
        idx_next = amount_indices[k + 1] if k + 1 < len(amount_indices) else None
        page_prev, y_prev, _ = bands[idx_prev] if idx_prev is not None else (page_a, y_a, {})
        page_next, y_next, next_amount_band = (
            bands[idx_next] if idx_next is not None else (page_a, y_a, {})
        )
        next_orphan = idx_next is not None and not _band_name_text(next_amount_band)

        buf = _DetailItemBuf()

        if idx_prev is None:
            for j in range(0, idx):
                # 首项之前不应出现「属上一项」的折行；照常吸收
                buf.absorb_band(bands[j][2])
        else:
            for j in range(idx_prev + 1, idx):
                p_mid, y_mid, mid_band = bands[j]
                # 规格/名称折行续段属于上一金额行，留给上一项的 post，勿并入本行
                if _band_is_wrap_continuation(mid_band):
                    continue
                if not _band_is_name_only(mid_band):
                    buf.absorb_band(mid_band)
                    continue
                name_text = _band_name_text(mid_band)
                if _attach_pre_name_band(
                    p_mid,
                    y_mid,
                    page_prev,
                    y_prev,
                    page_a,
                    y_a,
                    cur_amount_orphan=not _band_name_text(amount_band),
                    name_text=name_text,
                ):
                    buf.absorb_band(mid_band, name_source="pre")

        buf.absorb_band(amount_band, name_source="amount")

        post_end = idx_next if idx_next is not None else len(bands)
        for j in range(idx + 1, post_end):
            p_mid, y_mid, mid_band = bands[j]
            if _band_is_wrap_continuation(mid_band):
                if _band_is_name_only(mid_band):
                    name_text = _band_name_text(mid_band)
                    if idx_next is None or _attach_post_name_band(
                        p_mid,
                        y_mid,
                        page_a,
                        y_a,
                        page_next,
                        y_next,
                        next_amount_orphan=next_orphan,
                        name_text=name_text,
                    ):
                        buf.absorb_band(mid_band, name_source="post")
                else:
                    # 规格/单位折行（如「头」）固定归属当前行
                    buf.absorb_band(mid_band, name_source="post")
                continue
            if idx_next is None:
                continue
            if not _band_is_name_only(mid_band):
                continue
            name_text = _band_name_text(mid_band)
            if _attach_post_name_band(
                p_mid,
                y_mid,
                page_a,
                y_a,
                page_next,
                y_next,
                next_amount_orphan=next_orphan,
                name_text=name_text,
            ):
                buf.absorb_band(mid_band, name_source="post")

        cells = buf.to_cells()
        if _parse_invoice_detail_row(cells):
            items.append(cells)

    return _redistribute_y_merged_wrap_fragments(items)


def _is_footer_band(band: dict[str, list[tuple[float, float, str]]]) -> bool:
    joined = " ".join(t for parts in band.values() for _y, _x, t in parts)
    if _is_invoice_table_end_row([joined]):
        return True
    if "价税合计" in joined or (joined.startswith("合") and "计" in joined):
        return True
    return False


def extract_detail_rows_from_pdf_text_layer(pdf_bytes: bytes) -> list[list[str]]:
    if not PYMUPDF_AVAILABLE or fitz is None:
        return []
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception:
        return []

    all_bands: list[tuple[int, float, dict[str, list[tuple[float, float, str]]]]] = []
    anchors: dict[str, float] | None = None
    try:
        for page_no, page in enumerate(doc):
            words = page.get_text("words") or []
            if not words:
                continue
            page_anchors = anchors or _column_anchors_from_words(words)
            if not page_anchors:
                continue
            anchors = page_anchors
            header_y = _header_y_from_words(words)
            if header_y is None:
                continue
            all_bands.extend(
                _detail_items_from_page_words(
                    words, anchors, header_y=header_y, page_no=page_no
                )
            )
    finally:
        doc.close()
    return _group_bands_into_items(all_bands)


def extract_invoice_lines_from_pdf_text_layer(pdf_bytes: bytes) -> list[dict[str, Any]]:
    rows = extract_detail_rows_from_pdf_text_layer(pdf_bytes)
    lines: list[dict[str, Any]] = []
    for cells in rows:
        if _is_detail_table_header_row(cells):
            continue
        parsed = _parse_invoice_detail_row(cells)
        if parsed:
            parsed["line_no"] = len(lines) + 1
            lines.append(parsed)
    return lines


def extract_seller_name_from_pdf_text_layer(pdf_bytes: bytes) -> str | None:
    if not PYMUPDF_AVAILABLE or fitz is None:
        return None
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if doc.page_count < 1:
            doc.close()
            return None
        words = doc[0].get_text("words") or []
        doc.close()
    except Exception:
        return None
    if not words:
        return None
    by_y: dict[float, list[tuple[float, str]]] = defaultdict(list)
    for w in words:
        y_key = round(float(w[1]) / _Y_TOL) * _Y_TOL
        by_y[y_key].append((float(w[0]), str(w[4]).strip()))
    rows = [[t for _x, t in sorted(by_y[y], key=lambda item: item[0])] for y in sorted(by_y)]
    return parse_seller_name_from_ocr_rows(rows)
