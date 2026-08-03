"""采购订单 OCR 智能录单（KU-Draft）"""

from __future__ import annotations

from typing import Optional

from loguru import logger

from apps.kuaizhizao.schemas.purchase_order_ocr import PurchaseOrderOcrResult
from core.ai.draft_profiles import ensure_draft_profiles
from core.ai.structured_draft import StructuredDraftService
from infra.exceptions.exceptions import ValidationError


class PurchaseOrderOcrService:
    @staticmethod
    async def extract_from_image(
        *,
        tenant_id: int,
        image_bytes: bytes,
        content_type: Optional[str] = None,
    ) -> PurchaseOrderOcrResult:
        ensure_draft_profiles()
        result = await StructuredDraftService.structure_from_image(
            tenant_id,
            schema_name="purchase_order",
            image_bytes=image_bytes,
            content_type=content_type,
            result_type=PurchaseOrderOcrResult,
        )
        logger.info("purchase order OCR structured tenant_id={}", tenant_id)
        return result

    @staticmethod
    async def extract_from_text(
        *,
        tenant_id: int,
        text: str,
        context: Optional[PurchaseOrderOcrResult] = None,
    ) -> PurchaseOrderOcrResult:
        user_text = (text or "").strip()
        if not user_text:
            raise ValidationError("请输入采购订单描述或补充说明")

        ensure_draft_profiles()
        ctx_dict = None
        if context is not None:
            ctx_dict = context.model_dump(by_alias=True, exclude_none=True)

        return await StructuredDraftService.structure_text(
            tenant_id,
            schema_name="purchase_order",
            source_text=user_text,
            source_label="文本",
            result_type=PurchaseOrderOcrResult,
            context=ctx_dict,
        )
