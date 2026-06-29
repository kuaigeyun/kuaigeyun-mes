"""
销售订单 OCR 智能录单

DeepSeek 官方对话 API 仅支持文本，不支持 image_url。
流程：OCR 视觉端点提取单据文本 → DeepSeek 对话模型结构化填表字段。
"""

from __future__ import annotations

import base64
import json
import re
from typing import Any, Dict, Optional

from loguru import logger

from apps.kuaizhizao.schemas.sales_order_ocr import SalesOrderOcrResult
from core.services.system.site_setting_service import SiteSettingService
from core.utils.integration_settings import (
    DEEPSEEK_DEFAULT_BASE_URL,
    DEEPSEEK_DEFAULT_MODEL,
    get_deepseek_integration,
)
from infra.exceptions.exceptions import ValidationError
from infra.infrastructure.http import get_http_client

_STRUCTURE_SYSTEM_PROMPT = (
    "你是制造 ERP 销售订单结构化助手。"
    "用户会提供从单据 OCR 提取的文本、自然语言订单描述，或在已有解析草稿上的补充修改。"
    "请解析客户、日期、地址、付款与发货信息，"
    "以及明细行的产品编码、名称、规格、单位、数量、单价、税率、交货日期。"
    "对话补充时合并草稿与用户说明，覆盖冲突字段。"
    "无法确认的字段留 null，不要编造。"
    "仅输出一个 JSON 对象，不要 Markdown 代码块，不要额外说明。"
)

_IMAGE_TEXT_EXTRACT_PROMPT = (
    "请完整识别这张单据图片中的全部文字、数字与表格内容，"
    "按从上到下、从左到右的阅读顺序输出，保留行列结构，不要总结或省略。"
)

_STRUCTURE_JSON_SPEC = (
    "输出 JSON（camelCase），字段："
    "customerName, customerContact, customerPhone, shippingAddress, "
    "orderDate, deliveryDate, shippingMethod, paymentTerms, currencyCode, notes, confidenceNotes, "
    "items 数组每项含 materialCode, materialName, materialSpec, materialUnit, "
    "requiredQuantity, unitPrice, taxRate, deliveryDate, notes。"
    "日期格式 YYYY-MM-DD；数量与金额为数字。"
)

_OCR_NOT_CONFIGURED_MSG = (
    "DeepSeek 对话 API 不支持图片输入。"
    "请在站点设置 → 集成设置中配置 OCR 视觉端点（OCR Base URL 与 OCR 模型），"
    "例如硅基流动 https://api.siliconflow.cn/v1 + deepseek-ai/DeepSeek-OCR。"
)


def _extract_json_object(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        raise ValidationError("模型未返回有效内容")
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.IGNORECASE)
    if fence:
        raw = fence.group(1).strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                data = json.loads(raw[start : end + 1])
            except json.JSONDecodeError as inner:
                raise ValidationError("无法解析 OCR 结果 JSON") from inner
        else:
            raise ValidationError("无法解析 OCR 结果 JSON") from exc
    if not isinstance(data, dict):
        raise ValidationError("OCR 结果格式无效")
    return data


def _content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str) and part.strip():
                parts.append(part.strip())
            elif isinstance(part, dict):
                text = part.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
        return "\n".join(parts).strip()
    return str(content).strip()


def _message_text(message: Dict[str, Any]) -> str:
    if not message:
        return ""
    for key in ("content", "reasoning_content", "reasoning"):
        text = _content_to_text(message.get(key))
        if text:
            return text
    return ""


def _guess_image_mime(image_bytes: bytes, content_type: Optional[str]) -> str:
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime.startswith("image/"):
        return mime
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if image_bytes.startswith(b"GIF"):
        return "image/gif"
    if image_bytes[:4] == b"RIFF" and len(image_bytes) >= 12 and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    if image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return "image/jpeg"


def _is_deepseek_ocr_model(model: Optional[str]) -> bool:
    return "deepseek-ocr" in str(model or "").lower()


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
        site_settings = await SiteSettingService.get_settings(tenant_id)
        deepseek = get_deepseek_integration(site_settings.settings or {})
        if not deepseek.get("enabled"):
            raise ValidationError("DeepSeek 集成未启用，请在站点设置 → 集成设置中开启 KU-AI")
        api_key = deepseek.get("api_key")
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValidationError("未配置 DeepSeek API Key，无法使用 OCR 录单")

        chat_base_url = (deepseek.get("base_url") or DEEPSEEK_DEFAULT_BASE_URL).strip().rstrip("/")
        chat_model = str(deepseek.get("model") or DEEPSEEK_DEFAULT_MODEL).strip()

        ocr_base_raw = deepseek.get("ocr_base_url") or deepseek.get("vision_base_url")
        ocr_model_raw = deepseek.get("ocr_model") or deepseek.get("vision_model")
        ocr_base_url = str(ocr_base_raw).strip().rstrip("/") if ocr_base_raw else ""
        ocr_model = str(ocr_model_raw).strip() if ocr_model_raw else ""

        ocr_api_key_raw = deepseek.get("ocr_api_key")
        ocr_api_key = (
            ocr_api_key_raw.strip()
            if isinstance(ocr_api_key_raw, str) and ocr_api_key_raw.strip()
            else api_key.strip()
        )

        return {
            "chat_api_key": api_key.strip(),
            "chat_base_url": chat_base_url,
            "chat_model": chat_model,
            "ocr_base_url": ocr_base_url or None,
            "ocr_model": ocr_model or None,
            "ocr_api_key": ocr_api_key,
        }

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
        url = f"{base_url.rstrip('/')}/chat/completions"
        client = get_http_client()
        try:
            response = await client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                timeout=timeout,
            )
        except Exception as exc:
            logger.error(
                "sales order OCR request failed tenant_id={} url={} error={}",
                tenant_id,
                url,
                exc,
            )
            raise ValidationError(f"{error_prefix}：无法连接服务，请检查网络或 Base URL") from exc

        if response.status_code >= 400:
            detail = response.text
            try:
                body = response.json()
                detail = body.get("error", {}).get("message") or body.get("message") or detail
            except Exception:
                pass
            logger.warning(
                "sales order OCR error tenant_id={} url={} status={} detail={}",
                tenant_id,
                url,
                response.status_code,
                detail,
            )
            raise ValidationError(f"{error_prefix}：{detail}")

        try:
            return response.json()
        except ValueError as exc:
            raise ValidationError(f"{error_prefix}：服务返回了无效响应") from exc

    @staticmethod
    async def _extract_text_from_image(
        *,
        tenant_id: int,
        config: Dict[str, Any],
        mime: str,
        b64: str,
    ) -> str:
        ocr_base_url = config.get("ocr_base_url")
        ocr_model = config.get("ocr_model")
        if not ocr_base_url or not ocr_model:
            raise ValidationError(_OCR_NOT_CONFIGURED_MSG)

        image_part: Dict[str, Any] = {
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"},
        }
        ocr_prompt = _IMAGE_TEXT_EXTRACT_PROMPT
        if _is_deepseek_ocr_model(ocr_model):
            ocr_prompt = f"<image>\n{_IMAGE_TEXT_EXTRACT_PROMPT}"
        text_part = {"type": "text", "text": ocr_prompt}

        payload = {
            "model": ocr_model,
            "messages": [{"role": "user", "content": [image_part, text_part]}],
            "stream": False,
            "temperature": 0.1,
            "max_tokens": 4096,
        }
        body = await SalesOrderOcrService._post_chat_completions(
            tenant_id=tenant_id,
            base_url=ocr_base_url,
            api_key=config["ocr_api_key"],
            payload=payload,
            error_prefix="OCR 视觉识别失败",
        )
        choice = (body.get("choices") or [{}])[0]
        text = _message_text(choice.get("message") or {})
        if not text:
            raise ValidationError("OCR 未识别到有效文本，请更换更清晰的单据图片")
        return text

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
        text = _message_text(choice.get("message") or {})
        data = _extract_json_object(text)
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

        mime = _guess_image_mime(image_bytes, content_type)
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
