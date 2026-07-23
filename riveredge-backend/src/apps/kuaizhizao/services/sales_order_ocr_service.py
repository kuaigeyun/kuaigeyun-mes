"""
销售订单 OCR 智能录单

DeepSeek 官方对话 API 仅支持文本，不支持 image_url。
流程：OCR 视觉端点提取单据文本 → DeepSeek 对话模型结构化填表字段。
"""

from __future__ import annotations

import base64
import json
from typing import Any, Dict, Optional

from loguru import logger

from apps.kuaizhizao.schemas.sales_order_ocr import SalesOrderOcrResult
from core.utils.deepseek_vision_client import (
    OCR_NOT_CONFIGURED_MSG,
    extract_json_object,
    extract_text_from_image,
    get_deepseek_runtime_config,
    guess_image_mime,
    message_text,
    post_chat_completions,
)
from infra.exceptions.exceptions import ValidationError

_STRUCTURE_SYSTEM_PROMPT = (
    "你是制造 ERP 销售订单结构化助手。"
    "用户会提供从单据 OCR 提取的文本、自然语言订单描述，或在已有解析草稿上的补充修改。"
    "请解析客户、日期、地址、付款与发货信息，"
    "以及明细行的产品编码、名称、规格、单位、数量、单价、税率、交货日期。"
    "对话补充时合并草稿与用户说明，覆盖冲突字段。"
    "无法确认的字段留 null，不要编造。"
    "仅输出一个 JSON 对象，不要 Markdown 代码块，不要额外说明。"
)

_STRUCTURE_JSON_SPEC = (
    "输出 JSON（camelCase），字段："
    "customerName, customerContact, customerPhone, shippingAddress, "
    "orderDate, deliveryDate, shippingMethod, paymentTerms, currencyCode, notes, confidenceNotes, "
    "items 数组每项含 materialCode, materialName, materialSpec, materialUnit, "
    "requiredQuantity, unitPrice, taxRate, deliveryDate, notes。"
    "日期格式 YYYY-MM-DD；数量与金额为数字。"
)

# 兼容旧引用
_OCR_NOT_CONFIGURED_MSG = OCR_NOT_CONFIGURED_MSG


def _ocr_result_is_meaningful(result: SalesOrderOcrResult) -> bool:
    if (result.customer_name or "").strip():
        return True
    if (result.notes or "").strip() or (result.confidence_notes or "").strip():
        return True
    if any(
        [
            (result.customer_contact or "").strip(),
            (result.customer_phone or "").strip(),
            (result.shipping_address or "").strip(),
            (result.order_date or "").strip(),
            (result.delivery_date or "").strip(),
        ]
    ):
        return True
    for row in result.items or []:
        if any(
            [
                (row.material_code or "").strip(),
                (row.material_name or "").strip(),
                (row.material_spec or "").strip(),
                row.required_quantity not in (None, 0),
            ]
        ):
            return True
    return False


class SalesOrderOcrService:
    @staticmethod
    async def _get_runtime_config(tenant_id: int) -> Dict[str, Any]:
        return await get_deepseek_runtime_config(tenant_id)

    @staticmethod
    async def _post_chat_completions(
        *,
        tenant_id: int,
        base_url: str,
        api_key: str,
        payload: Dict[str, Any],
        error_prefix: str,
        timeout: float = 180.0,
    ) -> Dict[str, Any]:
        return await post_chat_completions(
            tenant_id=tenant_id,
            base_url=base_url,
            api_key=api_key,
            payload=payload,
            error_prefix=error_prefix,
            timeout=timeout,
            log_label="sales order OCR",
        )

    @staticmethod
    async def _extract_text_from_image(
        *,
        tenant_id: int,
        config: Dict[str, Any],
        mime: str,
        b64: str,
    ) -> str:
        return await extract_text_from_image(
            tenant_id=tenant_id,
            config=config,
            mime=mime,
            b64=b64,
        )

    @staticmethod
    async def _structure_source_text(
        *,
        tenant_id: int,
        config: Dict[str, Any],
        source_text: str,
        source_label: str = "OCR 文本",
    ) -> SalesOrderOcrResult:
        user_content = (
            f"根据以下{source_label}，{_STRUCTURE_JSON_SPEC}\n\n---\n{source_label}：\n{source_text}"
        )
        if source_label == "OCR 文本":
            user_content = (
                f"以下是从销售订单/采购单据图片 OCR 提取的文本，可能含表格与多行明细。"
                f"请尽量还原全部客户信息与每一行产品明细，不要返回空 items。"
                f"{_STRUCTURE_JSON_SPEC}\n\n---\nOCR 文本：\n{source_text}"
            )
        payload = {
            "model": config["chat_model"],
            "messages": [
                {"role": "system", "content": _STRUCTURE_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "response_format": {"type": "json_object"},
            "stream": False,
            "temperature": 0.1,
        }
        body = await SalesOrderOcrService._post_chat_completions(
            tenant_id=tenant_id,
            base_url=config["chat_base_url"],
            api_key=config["chat_api_key"],
            payload=payload,
            error_prefix="销售订单字段结构化失败",
        )
        choice = (body.get("choices") or [{}])[0]
        text = message_text(choice.get("message") or {})
        data = extract_json_object(text)
        items_raw = data.get("items") or []
        if isinstance(items_raw, list):
            data["items"] = [row for row in items_raw if isinstance(row, dict)]
        else:
            data["items"] = []
        result = SalesOrderOcrResult.model_validate(data)
        if source_label == "OCR 文本" and not _ocr_result_is_meaningful(result):
            logger.warning(
                "sales order OCR structured empty result tenant_id={} ocr_text_len={}",
                tenant_id,
                len(source_text),
            )
            raise ValidationError(
                "未能从图片中识别出有效的销售订单信息，请上传更清晰的照片，或改用文字描述录单"
            )
        return result

    @staticmethod
    async def extract_from_image(
        *,
        tenant_id: int,
        image_bytes: bytes,
        content_type: Optional[str] = None,
    ) -> SalesOrderOcrResult:
        if not image_bytes:
            raise ValidationError("请上传图片文件")
        if len(image_bytes) > 12 * 1024 * 1024:
            raise ValidationError("图片大小不能超过 12MB")

        mime = guess_image_mime(image_bytes, content_type)
        if not mime.startswith("image/"):
            raise ValidationError("仅支持图片格式（JPG、PNG、WEBP 等）")

        config = await SalesOrderOcrService._get_runtime_config(tenant_id)
        b64 = base64.b64encode(image_bytes).decode("ascii")
        ocr_text = await SalesOrderOcrService._extract_text_from_image(
            tenant_id=tenant_id,
            config=config,
            mime=mime,
            b64=b64,
        )
        logger.info(
            "sales order OCR text extracted tenant_id={} mime={} text_len={}",
            tenant_id,
            mime,
            len(ocr_text),
        )
        return await SalesOrderOcrService._structure_source_text(
            tenant_id=tenant_id,
            config=config,
            source_text=ocr_text,
            source_label="OCR 文本",
        )

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

        config = await SalesOrderOcrService._get_runtime_config(tenant_id)
        if context is not None:
            draft_json = context.model_dump(by_alias=True, exclude_none=True)
            source_text = (
                "当前解析草稿（JSON，可在其基础上合并用户补充）：\n"
                f"{json.dumps(draft_json, ensure_ascii=False)}\n\n"
                f"用户说明：\n{user_text}"
            )
            source_label = "对话输入"
        else:
            source_text = user_text
            source_label = "订单描述"

        return await SalesOrderOcrService._structure_source_text(
            tenant_id=tenant_id,
            config=config,
            source_text=source_text,
            source_label=source_label,
        )
