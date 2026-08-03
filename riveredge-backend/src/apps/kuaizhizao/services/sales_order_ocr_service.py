"""
销售订单 OCR 智能录单

DeepSeek 官方对话 API 仅支持文本，不支持 image_url。
流程：OCR 视觉端点提取单据文本 → DeepSeek 对话模型结构化填表字段。
"""

from __future__ import annotations

import json
from typing import Optional

from loguru import logger

from apps.kuaizhizao.schemas.sales_order_ocr import SalesOrderOcrResult
from core.ai.draft_profiles import ensure_draft_profiles
from core.ai.structured_draft import StructuredDraftService
from core.utils.deepseek_vision_client import OCR_NOT_CONFIGURED_MSG
from infra.exceptions.exceptions import ValidationError

# 兼容旧引用
_OCR_NOT_CONFIGURED_MSG = OCR_NOT_CONFIGURED_MSG


class SalesOrderOcrService:
    @staticmethod
    async def extract_from_image(
        *,
        tenant_id: int,
        image_bytes: bytes,
        content_type: Optional[str] = None,
    ) -> SalesOrderOcrResult:
        ensure_draft_profiles()
        result = await StructuredDraftService.structure_from_image(
            tenant_id,
            schema_name="sales_order",
            image_bytes=image_bytes,
            content_type=content_type,
            result_type=SalesOrderOcrResult,
        )
        logger.info("sales order OCR structured tenant_id={}", tenant_id)
        return result

    @staticmethod
    async def extract_from_text(
        *,
        tenant_id: int,
        text: str,
        context: Optional[SalesOrderOcrResult] = None,
    ) -> SalesOrderOcrResult:
        user_text = (text or "").strip()
        if not user_text:
            raise ValidationError("请输入订单描述或补充说明")

        ensure_draft_profiles()
        ctx_dict = None
        source_label = "订单描述"
        if context is not None:
            ctx_dict = context.model_dump(by_alias=True, exclude_none=True)
            source_label = "对话输入"

        return await StructuredDraftService.structure_text(
            tenant_id,
            schema_name="sales_order",
            source_text=user_text,
            source_label=source_label,
            result_type=SalesOrderOcrResult,
            context=ctx_dict,
        )
