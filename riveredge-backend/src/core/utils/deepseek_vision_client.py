"""
DeepSeek / OpenAI 兼容视觉 OCR 客户端

DeepSeek 官方对话 API 仅支持文本；图片需走独立 OCR 视觉端点（如硅基流动 DeepSeek-OCR）。
供销售订单智能录单、发票 AI 识别等复用。
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional

from loguru import logger

from core.services.system.site_setting_service import SiteSettingService
from core.utils.integration_settings import (
    DEEPSEEK_DEFAULT_BASE_URL,
    DEEPSEEK_DEFAULT_MODEL,
    get_deepseek_integration,
    is_deepseek_ocr_endpoint_configured,
)
from infra.exceptions.exceptions import ValidationError
from infra.infrastructure.http import get_http_client

OCR_NOT_CONFIGURED_MSG = (
    "DeepSeek 对话 API 不支持图片输入。"
    "请在站点设置 → 集成设置中配置 OCR 视觉端点（OCR Base URL 与 OCR 模型），"
    "例如硅基流动 https://api.siliconflow.cn/v1 + deepseek-ai/DeepSeek-OCR。"
)

DEFAULT_IMAGE_TEXT_EXTRACT_PROMPT = (
    "请完整识别这张单据图片中的全部文字、数字与表格内容，"
    "按从上到下、从左到右的阅读顺序输出，保留行列结构，不要总结或省略。"
)


def extract_json_object(text: str) -> Dict[str, Any]:
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


def content_to_text(content: Any) -> str:
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


def message_text(message: Dict[str, Any]) -> str:
    if not message:
        return ""
    for key in ("content", "reasoning_content", "reasoning"):
        text = content_to_text(message.get(key))
        if text:
            return text
    return ""


def guess_image_mime(image_bytes: bytes, content_type: Optional[str] = None) -> str:
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


def is_deepseek_ocr_model(model: Optional[str]) -> bool:
    return "deepseek-ocr" in str(model or "").lower()


async def get_deepseek_runtime_config(tenant_id: int) -> Dict[str, Any]:
    site_settings = await SiteSettingService.get_settings(tenant_id)
    deepseek = get_deepseek_integration(site_settings.settings or {})
    if not deepseek.get("enabled"):
        raise ValidationError("DeepSeek 集成未启用，请在站点设置 → 集成设置中开启 KU-AI")
    api_key = deepseek.get("api_key")
    if not isinstance(api_key, str) or not api_key.strip():
        raise ValidationError("未配置 DeepSeek API Key，无法使用 OCR")

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
        "ocr_configured": is_deepseek_ocr_endpoint_configured(deepseek),
    }


async def post_chat_completions(
    *,
    tenant_id: int,
    base_url: str,
    api_key: str,
    payload: Dict[str, Any],
    error_prefix: str,
    timeout: float = 180.0,
    log_label: str = "deepseek vision",
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
            "{} request failed tenant_id={} url={} error={}",
            log_label,
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
            "{} error tenant_id={} url={} status={} detail={}",
            log_label,
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


async def extract_text_from_image(
    *,
    tenant_id: int,
    config: Dict[str, Any],
    mime: str,
    b64: str,
    prompt: str = DEFAULT_IMAGE_TEXT_EXTRACT_PROMPT,
    max_tokens: int = 4096,
) -> str:
    ocr_base_url = config.get("ocr_base_url")
    ocr_model = config.get("ocr_model")
    if not ocr_base_url or not ocr_model:
        raise ValidationError(OCR_NOT_CONFIGURED_MSG)

    image_part: Dict[str, Any] = {
        "type": "image_url",
        "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"},
    }
    ocr_prompt = prompt
    if is_deepseek_ocr_model(str(ocr_model)):
        ocr_prompt = f"<image>\n{prompt}"
    text_part = {"type": "text", "text": ocr_prompt}

    payload = {
        "model": ocr_model,
        "messages": [{"role": "user", "content": [image_part, text_part]}],
        "stream": False,
        "temperature": 0.1,
        "max_tokens": max_tokens,
    }
    body = await post_chat_completions(
        tenant_id=tenant_id,
        base_url=str(ocr_base_url),
        api_key=config["ocr_api_key"],
        payload=payload,
        error_prefix="OCR 视觉识别失败",
        log_label="deepseek OCR",
    )
    choice = (body.get("choices") or [{}])[0]
    text = message_text(choice.get("message") or {})
    if not text:
        raise ValidationError("OCR 未识别到有效文本，请更换更清晰的单据图片")
    return text
