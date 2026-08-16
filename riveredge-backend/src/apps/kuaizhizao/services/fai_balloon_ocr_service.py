"""
FAI 图纸气泡 OCR（自研）

复用租户 OCR 视觉端点提取文字，再结构化为带归一化坐标的气泡候选。
禁止移植 OpenFAI 源码。
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Any, Dict, List, Optional

from loguru import logger

from apps.kuaizhizao.schemas.fai_balloon_ocr import FaiBalloonCandidate, FaiBalloonOcrResult
from core.ai.draft_profiles import ensure_draft_profiles
from core.ai.structured_draft import StructuredDraftService
from core.utils.deepseek_vision_client import (
    extract_json_object,
    extract_text_from_image,
    guess_image_mime,
)
from core.ai.runtime_config import AiRuntimeConfig
from infra.exceptions.exceptions import ValidationError

_BALLOON_OCR_PROMPT = (
    "这是一张工程图纸（可能已有或没有气泡编号）。"
    "请识别图中尺寸、公差、几何特性相关标注。"
    "尽可能估计每个特性在图上的位置：以图片左上角为原点，"
    "x/y 为相对宽度/高度的比例（0~1）。"
    "若图上已有气泡号，保留该编号；否则按阅读顺序编号。"
    "仅输出一个 JSON 对象，不要 Markdown。"
    '格式：{"candidates":[{"balloon_no":"1","characteristic_name":"外径",'
    '"nominal_value":10.0,"upper_tolerance":0.1,"lower_tolerance":-0.1,'
    '"unit":"mm","x":0.72,"y":0.35,"anchor_x":0.55,"anchor_y":0.40}],'
    '"confidenceNotes":"..."}'
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


def _normalize_candidate(raw: Dict[str, Any], index: int) -> Optional[FaiBalloonCandidate]:
    name = str(
        raw.get("characteristic_name")
        or raw.get("characteristicName")
        or raw.get("name")
        or ""
    ).strip()
    if not name:
        return None
    balloon_no = str(raw.get("balloon_no") or raw.get("balloonNo") or index).strip() or str(index)
    x = _clamp01(raw.get("x"))
    y = _clamp01(raw.get("y"))
    if x is None or y is None:
        # 无坐标时靠右缘自动排布，便于人工拖到正确位置
        x = 0.88
        y = min(0.12 + (index - 1) * 0.08, 0.92)
    return FaiBalloonCandidate(
        id=str(raw.get("id") or f"ocr_{uuid.uuid4().hex[:10]}"),
        balloon_no=balloon_no,
        characteristic_name=name,
        nominal_value=_opt_float(raw.get("nominal_value") or raw.get("nominalValue") or raw.get("nominal")),
        upper_tolerance=_opt_float(
            raw.get("upper_tolerance") or raw.get("upperTolerance") or raw.get("upper")
        ),
        lower_tolerance=_opt_float(
            raw.get("lower_tolerance") or raw.get("lowerTolerance") or raw.get("lower")
        ),
        unit=(str(raw.get("unit")).strip() if raw.get("unit") is not None else None) or None,
        remarks=(
            str(raw.get("remarks") or raw.get("note") or "").strip() or None
        ),
        x=x,
        y=y,
        anchor_x=_clamp01(raw.get("anchor_x") or raw.get("anchorX")),
        anchor_y=_clamp01(raw.get("anchor_y") or raw.get("anchorY")),
        source="ocr",
    )


def _from_raw_result(data: Dict[str, Any]) -> FaiBalloonOcrResult:
    rows = data.get("candidates") or data.get("items") or []
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
        ocr_text = await extract_text_from_image(
            tenant_id=tenant_id,
            config=vision_config,
            mime=mime,
            b64=b64,
            prompt=_BALLOON_OCR_PROMPT,
            max_tokens=8192,
        )

        # 视觉端点若已直接返回 JSON，优先采用
        try:
            direct = extract_json_object(ocr_text)
            result = _from_raw_result(direct)
            if result.candidates:
                logger.info(
                    "fai balloon OCR direct-json tenant_id={} count={}",
                    tenant_id,
                    len(result.candidates),
                )
                return result
        except ValidationError:
            pass

        ensure_draft_profiles()
        profile = StructuredDraftService.get_profile("fai_balloon")
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
        if not structured.candidates:
            fence = re.search(r"\{[\s\S]*\}", ocr_text)
            if fence:
                try:
                    structured = _from_raw_result(json.loads(fence.group(0)))
                except Exception:
                    pass
        if not structured.candidates:
            raise ValidationError(
                "未能从图纸中识别出尺寸/公差气泡，请换更清晰图片或改为手工点选放置"
            )
        logger.info(
            "fai balloon OCR structured tenant_id={} count={}",
            tenant_id,
            len(structured.candidates),
        )
        return structured
