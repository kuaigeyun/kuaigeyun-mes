"""
DeepSeek 对话服务

从站点设置读取 API Key，代理调用 DeepSeek Chat Completions API。
支持业务单据工具调用（查询真实数据，遵守 RBAC / DataScope）。
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import httpx
from loguru import logger

from apps.kuaiai.services.chat_tools import CHAT_TOOL_DEFINITIONS, ChatToolExecutor
from apps.kuaiai.services.rag_service import RagService
from core.services.system.site_setting_service import SiteSettingService
from core.utils.integration_settings import (
    DEEPSEEK_DEFAULT_BASE_URL,
    DEEPSEEK_DEFAULT_MODEL,
    build_deepseek_public_status,
    get_deepseek_integration,
)
from infra.exceptions.exceptions import ValidationError
from infra.infrastructure.http import get_http_client
from infra.models.user import User

KUAI_SYSTEM_PROMPT = (
    "你是 KU-AI，RiverEdge 制造管理系统的智能助手。"
    "请用简洁、准确的中文回答用户关于系统功能操作、业务流程与数据查询的问题。"
    "若问题超出当前能力或缺少依据，请如实说明，不要编造功能或数据。"
    "呈现多行多列数据（如库存明细、搜索结果、对比列表）时，请使用 GitHub 风格 Markdown 表格，"
    "不要用空格对齐的纯文本；示例：\n"
    "| 列1 | 列2 |\n| --- | --- |\n| 值 | 值 |"
)

KUAI_TOOLS_SYSTEM_APPEND = (
    "\n\n你可以通过工具查询真实业务数据，覆盖快制造、好力 GO、主数据等模块的"
    "工单、销售/采购订单、出入库、检验、委外、设备模具台账及即时库存等。"
    "规则：\n"
    "1. 用户询问具体单号、单据状态、数量、库存时，必须先调用工具，禁止编造数据。\n"
    "2. 不确定单据类型时，使用跨类型搜索；需要类型列表时先 list_business_document_types。\n"
    "3. 仅展示工具返回且用户有权查看的数据；无权时如实说明。\n"
    "4. 操作指引类问题可结合系统常识回答，必要时再查单验证。\n"
    "5. 回答中注明单据类型与编码，便于用户到系统中定位。\n"
    "6. 工具返回含 markdown_table 字段时，请在回复中原样保留该表格；"
    "多条记录须用 Markdown 表格展示，禁止空格对齐伪表格。"
)

MAX_TOOL_ROUNDS = 6


def _normalize_user_chat_messages(messages: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []
    for item in messages:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip()
        content = item.get("content")
        if isinstance(content, str):
            text = content.strip()
        elif content is None:
            text = ""
        else:
            text = str(content).strip()
        if not text:
            continue
        if role in {"ai", "assistant"}:
            role = "assistant"
        elif role == "user":
            role = "user"
        elif role == "system":
            role = "system"
        else:
            continue
        normalized.append({"role": role, "content": text})
    return normalized


def _build_system_prompt(*, enable_tools: bool, custom_append: str | None = None) -> str:
    prompt = KUAI_SYSTEM_PROMPT
    if enable_tools:
        prompt += KUAI_TOOLS_SYSTEM_APPEND
    extra = (custom_append or "").strip()
    if extra:
        prompt += f"\n\n【企业补充说明】\n{extra}"
    return prompt


def _with_system_prompt(
    messages: List[Dict[str, Any]],
    *,
    enable_tools: bool,
    custom_append: str | None = None,
) -> List[Dict[str, Any]]:
    system_content = _build_system_prompt(enable_tools=enable_tools, custom_append=custom_append)
    if messages and messages[0].get("role") == "system":
        merged = list(messages)
        merged[0] = {"role": "system", "content": system_content}
        return merged
    return [{"role": "system", "content": system_content}, *messages]


class DeepSeekService:
    """DeepSeek 集成配置与对话代理。"""

    @staticmethod
    async def get_public_status(tenant_id: int) -> Dict[str, Any]:
        site_settings = await SiteSettingService.get_settings(tenant_id)
        return build_deepseek_public_status(site_settings.settings or {})

    @staticmethod
    async def _get_runtime_config(tenant_id: int) -> Dict[str, Any]:
        site_settings = await SiteSettingService.get_settings(tenant_id)
        deepseek = get_deepseek_integration(site_settings.settings or {})
        api_key = deepseek.get("api_key")
        if not deepseek.get("enabled"):
            raise ValidationError("DeepSeek 集成未启用，请在站点设置 → 集成设置中开启")
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValidationError("未配置 DeepSeek API Key，请在站点设置 → 集成设置中填写")

        base_url = (deepseek.get("base_url") or DEEPSEEK_DEFAULT_BASE_URL).strip().rstrip("/")
        model = (deepseek.get("model") or DEEPSEEK_DEFAULT_MODEL).strip()
        custom_prompt = deepseek.get("custom_system_prompt")
        if isinstance(custom_prompt, str):
            custom_prompt = custom_prompt.strip() or None
        else:
            custom_prompt = None
        tools_enabled = deepseek.get("tools_enabled")
        if tools_enabled is None:
            tools_enabled = True
        rag_enabled = deepseek.get("rag_enabled")
        if rag_enabled is None:
            rag_enabled = True
        return {
            "api_key": api_key.strip(),
            "base_url": base_url,
            "model": model,
            "custom_system_prompt": custom_prompt,
            "tools_enabled": bool(tools_enabled),
            "rag_enabled": bool(rag_enabled),
            "rag_use_embedding": deepseek.get("rag_use_embedding", True) is not False,
            "rag_top_k": int(deepseek.get("rag_top_k") or 5),
        }

    @staticmethod
    async def _post_chat_completion(
        *,
        config: Dict[str, Any],
        payload: Dict[str, Any],
        tenant_id: int,
    ) -> Dict[str, Any]:
        url = f"{config['base_url']}/chat/completions"
        client = get_http_client()
        try:
            response = await client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {config['api_key']}",
                    "Content-Type": "application/json",
                },
                timeout=120.0,
            )
        except httpx.RequestError as exc:
            logger.error("DeepSeek 请求失败 tenant_id={} url={} error={}", tenant_id, url, exc)
            raise ValidationError("无法连接 DeepSeek 服务，请检查网络或 Base URL") from exc

        if response.status_code >= 400:
            detail = response.text
            try:
                body = response.json()
                detail = body.get("error", {}).get("message") or body.get("message") or detail
            except Exception:
                pass
            logger.warning(
                "DeepSeek 返回错误 tenant_id={} status={} detail={}",
                tenant_id,
                response.status_code,
                detail,
            )
            raise ValidationError(f"DeepSeek 调用失败：{detail}")

        try:
            return response.json()
        except ValueError as exc:
            raise ValidationError("DeepSeek 返回了无效的 JSON 响应") from exc

    @staticmethod
    async def create_chat_completion(
        tenant_id: int,
        messages: List[Dict[str, Any]],
        *,
        model: Optional[str] = None,
        temperature: Optional[float] = 0.7,
        stream: bool = False,
        user: Optional[User] = None,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
    ) -> Dict[str, Any]:
        if stream:
            raise ValidationError("当前仅支持非流式对话")

        if not messages:
            raise ValidationError("messages 不能为空")

        normalized_messages = _normalize_user_chat_messages(messages)
        if not normalized_messages:
            raise ValidationError("messages 不能为空")

        config = await DeepSeekService._get_runtime_config(tenant_id)
        use_tools = bool(config.get("tools_enabled")) and user is not None
        working_messages: List[Dict[str, Any]] = _with_system_prompt(
            list(normalized_messages),
            enable_tools=use_tools,
            custom_append=config.get("custom_system_prompt"),
        )

        if user is not None and config.get("rag_enabled", True) is not False:
            last_user = ""
            for msg in reversed(normalized_messages):
                if msg.get("role") == "user":
                    last_user = str(msg.get("content") or "")
                    break
            if last_user.strip():
                rag_context = await RagService.build_context_for_query(
                    tenant_id=tenant_id,
                    query=last_user,
                    top_k=int(config.get("rag_top_k") or 5),
                )
                if rag_context and working_messages and working_messages[0].get("role") == "system":
                    working_messages[0]["content"] = (
                        f"{working_messages[0]['content']}\n\n【知识库参考】\n{rag_context}"
                    )

        tool_executor: ChatToolExecutor | None = None
        if use_tools:
            tool_executor = ChatToolExecutor(
                tenant_id=tenant_id,
                user=user,
                is_infra_admin=is_infra_admin,
                is_tenant_admin=is_tenant_admin,
            )

        last_response: Dict[str, Any] | None = None
        for _ in range(MAX_TOOL_ROUNDS):
            payload: Dict[str, Any] = {
                "model": model or config["model"],
                "messages": working_messages,
                "stream": False,
                "temperature": temperature if temperature is not None else 0.7,
            }
            if use_tools:
                payload["tools"] = CHAT_TOOL_DEFINITIONS
                payload["tool_choice"] = "auto"

            last_response = await DeepSeekService._post_chat_completion(
                config=config,
                payload=payload,
                tenant_id=tenant_id,
            )
            choice = (last_response.get("choices") or [{}])[0]
            message = choice.get("message") or {}
            tool_calls = message.get("tool_calls") or []

            if not use_tools or not tool_calls or tool_executor is None:
                return last_response

            working_messages.append(message)
            for call in tool_calls:
                fn = (call.get("function") or {})
                name = str(fn.get("name") or "")
                raw_args = fn.get("arguments") or "{}"
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args or {})
                except json.JSONDecodeError:
                    args = {}
                result = await tool_executor.execute(name, args)
                working_messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.get("id"),
                        "content": result,
                    }
                )

        return last_response or {}
