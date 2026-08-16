"""
FAI 图纸气泡 OCR（自研）

路径：OCR 视觉端点抽尺寸文字 →（可选）直接 JSON → 对话模型结构化 → 正则补全合并。
DeepSeek-OCR 擅长抽字，不擅长直接吐带坐标的 JSON，故默认用纯文本抽取 prompt。
结构化若只返回少数条，仍用正则从 OCR 全文补全，避免「只识别到 1 个」。
禁止移植 OpenFAI 源码。
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from apps.kuaizhizao.schemas.fai_balloon_ocr import FaiBalloonCandidate, FaiBalloonOcrResult
from core.ai.draft_profiles import ensure_draft_profiles
from core.ai.structured_draft import StructuredDraftService
from core.utils.deepseek_vision_client import (
    extract_json_object,
    extract_text_from_image,
    guess_image_mime,
    is_deepseek_ocr_model,
)
from core.ai.runtime_config import AiRuntimeConfig
from infra.exceptions.exceptions import ValidationError

# DeepSeek-OCR / 纯 OCR：只抽字；一行一尺寸，便于规则补全
_BALLOON_PLAIN_OCR_PROMPT = (
    "请完整识别这张工程图纸上的全部尺寸、公差、形位公差、圆角、螺纹与气泡编号。"
    "要求：每个尺寸单独占一行输出，不要合并到同一行，不要总结或省略。"
    "保留数字与符号（如 Ø、φ、±、R、M、°、H7、g6、4-R10），"
    "例如：\nØ50±0.02\n65\n4-R10\n108\nR6.3"
)

# 通用视觉多模态：可直接要 JSON（仍会与正则结果合并）
_BALLOON_JSON_OCR_PROMPT = (
    "这是一张工程图纸。请识别图中全部尺寸、公差、圆角、螺纹等检验特性，尽量多条。"
    "估计每个特性在图上的位置（左上原点，x/y 为 0~1）。"
    "若已有气泡号则保留，否则按阅读顺序编号。"
    "仅输出一个 JSON 对象，不要 Markdown。"
    '格式：{"candidates":[{"balloon_no":"1","characteristic_name":"外径",'
    '"nominal_value":10.0,"upper_tolerance":0.1,"lower_tolerance":-0.1,'
    '"unit":"mm","x":0.72,"y":0.35,"anchor_x":0.55,"anchor_y":0.40}],'
    '"confidenceNotes":"..."}'
)

# 4-R10 / Ø12±0.02 / φ50H7 / 25±0.1 / R6.3 / M8 / 12.5+0.1/-0.05 / 裸数字尺寸
_DIM_LINE_RE = re.compile(
    r"(?:"
    r"(?P<qty>\d+)\s*[-×xX*]\s*(?P<label>[ØøφΦ⌀RrMm])\s*(?P<nom>\d+(?:\.\d+)?)"
    r"|"
    r"(?P<label2>[ØøφΦ⌀RrMm])\s*(?P<nom2>\d+(?:\.\d+)?)"
    r"|"
    r"(?P<nom3>\d+(?:\.\d+)?)"
    r")"
    r"(?:"
    r"\s*[±]\s*(?P<sym>\d+(?:\.\d+)?)"
    r"|"
    r"\s*\+\s*(?P<up>\d+(?:\.\d+)?)\s*/?\s*-\s*(?P<lo>\d+(?:\.\d+)?)"
    r"|"
    r"\s*(?P<fit>[HhGgFfEeDdCcBbAaNnPpSsTt]\d+)"
    r")?",
)

_TITLE_NOISE_RE = re.compile(
    r"(公司|材料|比例|版本|图号|重量|零件名称|日期|审批|会签|描图|底图|共\s*\d+\s*页)"
)


def _clamp01(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if n < 0:
        return 0.0
    if n > 1:
        return 1.0
    return n


def _opt_float(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _label_prefix(label: Optional[str]) -> str:
    if not label:
        return "尺寸"
    ch = label.strip()[:1]
    if ch in "ØøφΦ⌀":
        return "直径"
    if ch in "Rr":
        return "圆角"
    if ch in "Mm":
        return "螺纹"
    return "尺寸"


def _normalize_candidate(raw: Dict[str, Any], index: int) -> Optional[FaiBalloonCandidate]:
    name = str(
        raw.get("characteristic_name")
        or raw.get("characteristicName")
        or raw.get("name")
        or raw.get("label")
        or ""
    ).strip()
    balloon_no = str(raw.get("balloon_no") or raw.get("balloonNo") or index).strip() or str(index)
    nominal = _opt_float(raw.get("nominal_value") or raw.get("nominalValue") or raw.get("nominal"))
    if not name:
        if nominal is not None:
            name = f"尺寸{nominal:g}"
        elif balloon_no:
            name = f"特性{balloon_no}"
        else:
            return None
    x = _clamp01(raw.get("x"))
    y = _clamp01(raw.get("y"))
    if x is None or y is None:
        x = 0.88
        y = min(0.08 + (index - 1) * 0.035, 0.95)
    return FaiBalloonCandidate(
        id=str(raw.get("id") or f"ocr_{uuid.uuid4().hex[:10]}"),
        balloon_no=balloon_no,
        characteristic_name=name,
        nominal_value=nominal,
        upper_tolerance=_opt_float(
            raw.get("upper_tolerance") or raw.get("upperTolerance") or raw.get("upper")
        ),
        lower_tolerance=_opt_float(
            raw.get("lower_tolerance") or raw.get("lowerTolerance") or raw.get("lower")
        ),
        unit=(str(raw.get("unit")).strip() if raw.get("unit") is not None else None) or None,
        remarks=(str(raw.get("remarks") or raw.get("note") or "").strip() or None),
        x=x,
        y=y,
        anchor_x=_clamp01(raw.get("anchor_x") or raw.get("anchorX")),
        anchor_y=_clamp01(raw.get("anchor_y") or raw.get("anchorY")),
        source=str(raw.get("source") or "ocr"),
    )


def _from_raw_result(data: Dict[str, Any]) -> FaiBalloonOcrResult:
    rows = data.get("candidates") or data.get("items") or data.get("balloons") or []
    if not isinstance(rows, list):
        rows = []
    candidates: List[FaiBalloonCandidate] = []
    for idx, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue
        item = _normalize_candidate(row, idx)
        if item:
            candidates.append(item)
    notes = data.get("confidence_notes") or data.get("confidenceNotes")
    return FaiBalloonOcrResult(
        candidates=candidates,
        confidence_notes=str(notes).strip() if notes else None,
    )


def _match_to_raw(m: re.Match[str]) -> Optional[Dict[str, Any]]:
    nom = m.groupdict().get("nom") or m.groupdict().get("nom2") or m.groupdict().get("nom3")
    if not nom:
        return None
    try:
        nom_f = float(nom)
    except ValueError:
        return None
    label = m.groupdict().get("label") or m.groupdict().get("label2")
    if nom_f >= 1900 and nom_f <= 2100 and not label:
        return None
    if nom_f <= 0:
        return None
    # 无符号的过大整数多为图幅/页码噪声
    if not label and not m.group("sym") and not m.group("up") and not m.group("fit"):
        if nom_f > 2000:
            return None
    qty = m.groupdict().get("qty")
    sym = m.group("sym")
    up = m.group("up")
    lo = m.group("lo")
    fit = m.group("fit")
    span = m.group(0).strip()
    upper = _opt_float(sym or up)
    lower = -_opt_float(sym) if sym else (-_opt_float(lo) if lo else None)
    name = f"{_label_prefix(label)}{nom_f:g}"
    if qty:
        name = f"{qty}处{name}"
    if fit:
        name = f"{name} {fit}"
    return {
        "characteristic_name": name,
        "nominal_value": nom_f,
        "upper_tolerance": upper,
        "lower_tolerance": lower,
        "unit": "mm",
        "remarks": span,
        "source": "ocr_regex",
    }


def _candidates_from_plain_ocr(ocr_text: str) -> List[FaiBalloonCandidate]:
    """从纯 OCR 文本用正则抽取尺寸（不截断长行）。"""
    text = (ocr_text or "").strip()
    if not text:
        return []

    found: List[Tuple[str, Dict[str, Any]]] = []
    seen: set[str] = set()
    # 按行，并再按空白切开，避免整段超长被跳过
    chunks: List[str] = []
    for line in re.split(r"[\n\r;；|]+", text):
        line = line.strip()
        if not line:
            continue
        if _TITLE_NOISE_RE.search(line):
            continue
        chunks.append(line)
        if len(line) > 40:
            chunks.extend(p for p in re.split(r"[\s,，/]+", line) if p)

    for chunk in chunks:
        for m in _DIM_LINE_RE.finditer(chunk):
            raw = _match_to_raw(m)
            if not raw:
                continue
            key = str(raw["remarks"]).lower()
            if key in seen:
                continue
            seen.add(key)
            found.append((key, raw))
            if len(found) >= 80:
                break
        if len(found) >= 80:
            break

    out: List[FaiBalloonCandidate] = []
    for idx, (_span, raw) in enumerate(found, start=1):
        item = _normalize_candidate(raw, idx)
        if item:
            out.append(item)
    return out


def _dedupe_key(c: FaiBalloonCandidate) -> str:
    if c.nominal_value is not None:
        return f"n:{round(float(c.nominal_value), 4)}|{(c.remarks or c.characteristic_name or '').strip().lower()}"
    return f"t:{(c.characteristic_name or '').strip().lower()}"


def _merge_candidates(
    primary: List[FaiBalloonCandidate],
    secondary: List[FaiBalloonCandidate],
) -> List[FaiBalloonCandidate]:
    """主列表（结构化，可有坐标）优先；正则结果按 remarks/标称文案补全。"""
    out: List[FaiBalloonCandidate] = []
    seen: set[str] = set()
    for c in primary:
        k = _dedupe_key(c)
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
    for c in secondary:
        k = _dedupe_key(c)
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
    for i, c in enumerate(out, start=1):
        c.balloon_no = str(i)
        if c.source == "ocr_regex" or (c.x is not None and abs(float(c.x) - 0.88) < 1e-6):
            c.y = min(0.06 + (i - 1) * 0.032, 0.96)
            c.x = 0.88
    return out


class FaiBalloonOcrService:
    @staticmethod
    async def extract_from_image(
        *,
        tenant_id: int,
        image_bytes: bytes,
        content_type: Optional[str] = None,
    ) -> FaiBalloonOcrResult:
        if not image_bytes:
            raise ValidationError("请上传图纸图片")
        if len(image_bytes) > 12 * 1024 * 1024:
            raise ValidationError("图片大小不能超过 12MB")

        mime = guess_image_mime(image_bytes, content_type)
        if not mime.startswith("image/"):
            raise ValidationError("气泡 OCR 仅支持图片（JPG、PNG、WEBP），请先将 PDF 渲染为图片")

        import base64

        config = await AiRuntimeConfig.load(tenant_id)
        vision_config = {
            "ocr_base_url": config.ocr_base_url,
            "ocr_model": config.ocr_model,
            "ocr_api_key": config.ocr_api_key,
            "ocr_configured": config.ocr_configured,
        }
        b64 = base64.b64encode(image_bytes).decode("ascii")
        use_plain = is_deepseek_ocr_model(str(config.ocr_model or ""))
        prompt = _BALLOON_PLAIN_OCR_PROMPT if use_plain else _BALLOON_JSON_OCR_PROMPT
        ocr_text = await extract_text_from_image(
            tenant_id=tenant_id,
            config=vision_config,
            mime=mime,
            b64=b64,
            prompt=prompt,
            max_tokens=4096,
            image_detail="auto",
        )
        logger.info(
            "fai balloon OCR raw tenant_id={} model={} plain={} chars={}",
            tenant_id,
            config.ocr_model,
            use_plain,
            len(ocr_text or ""),
        )

        structured = FaiBalloonOcrResult(candidates=[])
        try:
            direct = extract_json_object(ocr_text)
            structured = _from_raw_result(direct)
            if structured.candidates:
                logger.info(
                    "fai balloon OCR direct-json tenant_id={} count={}",
                    tenant_id,
                    len(structured.candidates),
                )
        except ValidationError:
            pass

        if not structured.candidates:
            ensure_draft_profiles()
            profile = StructuredDraftService.get_profile("fai_balloon")
            try:
                data = await StructuredDraftService.complete_json(
                    tenant_id,
                    system=profile.system_prompt,
                    user_content=(
                        f"{profile.ocr_user_prefix}{profile.json_spec}\n\n---\nOCR 文本：\n{ocr_text}"
                    ),
                    error_prefix="FAI 气泡结构化失败",
                    temperature=0.1,
                )
                structured = _from_raw_result(data)
            except ValidationError as exc:
                logger.warning(
                    "fai balloon OCR structure failed tenant_id={} err={}",
                    tenant_id,
                    exc,
                )

        if not structured.candidates:
            fence = re.search(r"\{[\s\S]*\}", ocr_text)
            if fence:
                try:
                    structured = _from_raw_result(json.loads(fence.group(0)))
                except Exception:
                    pass

        regex_rows = _candidates_from_plain_ocr(ocr_text)
        merged = _merge_candidates(structured.candidates, regex_rows)
        if not merged:
            snippet = (ocr_text or "").replace("\n", " ")[:240]
            logger.warning(
                "fai balloon OCR empty tenant_id={} snippet={}",
                tenant_id,
                snippet,
            )
            raise ValidationError(
                "未能从图纸中识别出尺寸/公差气泡，请换更清晰图片或改为手工点选放置"
            )

        notes = structured.confidence_notes
        if regex_rows and len(merged) > len(structured.candidates):
            extra = f"已用 OCR 文本规则补全至 {len(merged)} 条，请核对坐标后确认"
            notes = f"{notes}；{extra}" if notes else extra

        logger.info(
            "fai balloon OCR done tenant_id={} structured={} regex={} merged={}",
            tenant_id,
            len(structured.candidates),
            len(regex_rows),
            len(merged),
        )
        return FaiBalloonOcrResult(candidates=merged, confidence_notes=notes)
