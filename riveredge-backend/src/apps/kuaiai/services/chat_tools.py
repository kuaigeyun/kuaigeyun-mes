"""KU-AI 对话工具：业务单据查询 + 库存查询。"""

from __future__ import annotations

import json
from typing import Any

from apps.kuaiai.services.business_document_service import BusinessDocumentService
from core.services.authorization.user_permission_service import UserPermissionService
from infra.exceptions.exceptions import AuthorizationError, NotFoundError, ValidationError
from infra.models.user import User

MAX_TOOL_RESULT_CHARS = 12_000

CHAT_TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "list_business_document_types",
            "description": "列出当前用户有权查询的业务单据/主数据类型。回答「有哪些单」「能查什么」时先调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "app": {
                        "type": "string",
                        "description": "按应用筛选，如 kuaizhizao、haoligo、master-data",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_business_documents",
            "description": "按单据类型与关键字搜索业务单据（编码、名称等）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "resource_key": {
                        "type": "string",
                        "description": "单据类型，如 kuaizhizao:work-order、kuaizhizao:outsource-order",
                    },
                    "keyword": {"type": "string", "description": "搜索关键字（单号、名称等）"},
                    "page": {"type": "integer", "description": "页码，默认 1"},
                    "page_size": {"type": "integer", "description": "每页条数，默认 10，最大 20"},
                },
                "required": ["resource_key", "keyword"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_business_documents_across_types",
            "description": "在多种单据类型中跨类型搜索关键字，适合用户未说明具体单据类型时。",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string", "description": "搜索关键字"},
                    "resource_keys": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "限定单据类型列表，留空则搜索全部可访问类型",
                    },
                    "limit_per_type": {"type": "integer", "description": "每种类型最多返回条数，默认 5"},
                },
                "required": ["keyword"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_business_document",
            "description": "按 ID 获取业务单据详情（含状态、数量等扩展字段）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "resource_key": {"type": "string", "description": "单据类型 resource_key"},
                    "record_id": {"type": "integer", "description": "单据 ID"},
                    "record_uuid": {"type": "string", "description": "单据 UUID（与 record_id 二选一）"},
                },
                "required": ["resource_key"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_inventory",
            "description": "查询物料即时库存（按物料编码/名称关键字）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string", "description": "物料编码或名称关键字"},
                    "warehouse_id": {"type": "integer", "description": "仓库 ID，可选"},
                    "page": {"type": "integer", "description": "页码，默认 1"},
                    "page_size": {"type": "integer", "description": "每页条数，默认 20"},
                },
            },
        },
    },
]


def _truncate_tool_result(payload: Any) -> str:
    text = json.dumps(payload, ensure_ascii=False, default=str)
    if len(text) <= MAX_TOOL_RESULT_CHARS:
        return text
    return text[: MAX_TOOL_RESULT_CHARS - 20] + "…(结果已截断)"


class ChatToolExecutor:
    def __init__(
        self,
        *,
        tenant_id: int,
        user: User,
        is_infra_admin: bool = False,
        is_tenant_admin: bool = False,
    ) -> None:
        self.tenant_id = tenant_id
        self.user = user
        self.is_infra_admin = is_infra_admin
        self.is_tenant_admin = is_tenant_admin

    async def execute(self, tool_name: str, arguments: dict[str, Any] | None) -> str:
        args = arguments or {}
        try:
            if tool_name == "list_business_document_types":
                items = await BusinessDocumentService.list_catalog(
                    tenant_id=self.tenant_id,
                    user=self.user,
                    app_filter=args.get("app"),
                    is_infra_admin=self.is_infra_admin,
                    is_tenant_admin=self.is_tenant_admin,
                )
                return _truncate_tool_result({"types": items, "total": len(items)})

            if tool_name == "search_business_documents":
                result = await BusinessDocumentService.search(
                    tenant_id=self.tenant_id,
                    user=self.user,
                    resource_key=str(args.get("resource_key") or ""),
                    keyword=str(args.get("keyword") or "") or None,
                    page=int(args.get("page") or 1),
                    page_size=min(int(args.get("page_size") or 10), 20),
                    is_infra_admin=self.is_infra_admin,
                    is_tenant_admin=self.is_tenant_admin,
                )
                return _truncate_tool_result(result)

            if tool_name == "search_business_documents_across_types":
                result = await BusinessDocumentService.search_multi(
                    tenant_id=self.tenant_id,
                    user=self.user,
                    keyword=str(args.get("keyword") or ""),
                    resource_keys=args.get("resource_keys"),
                    limit_per_type=min(int(args.get("limit_per_type") or 5), 10),
                    is_infra_admin=self.is_infra_admin,
                    is_tenant_admin=self.is_tenant_admin,
                )
                return _truncate_tool_result(result)

            if tool_name == "get_business_document":
                record_id = args.get("record_id")
                result = await BusinessDocumentService.get(
                    tenant_id=self.tenant_id,
                    user=self.user,
                    resource_key=str(args.get("resource_key") or ""),
                    record_id=int(record_id) if record_id is not None else None,
                    record_uuid=str(args.get("record_uuid") or "") or None,
                    is_infra_admin=self.is_infra_admin,
                    is_tenant_admin=self.is_tenant_admin,
                )
                return _truncate_tool_result(result)

            if tool_name == "search_inventory":
                return await self._search_inventory(args)

            return _truncate_tool_result({"error": f"未知工具: {tool_name}"})
        except (AuthorizationError, NotFoundError, ValidationError) as exc:
            return _truncate_tool_result({"error": str(exc)})
        except Exception as exc:
            return _truncate_tool_result({"error": f"工具执行失败: {exc}"})

    async def _search_inventory(self, args: dict[str, Any]) -> str:
        allowed = await UserPermissionService.has_permission(
            user_id=self.user.id,
            tenant_id=self.tenant_id,
            permission_code="kuaizhizao:warehouse-management-inventory:read",
        )
        if not allowed and not self.is_infra_admin and not self.is_tenant_admin:
            raise AuthorizationError(message="无权查询库存")

        try:
            from apps.kuaizhizao.services.report_service import ReportService
        except ImportError as exc:
            raise ValidationError("库存模块未安装") from exc

        service = ReportService()
        result = await service.get_inventory_material_balances(
            tenant_id=self.tenant_id,
            warehouse_id=args.get("warehouse_id"),
            keyword=str(args.get("keyword") or "") or None,
            include_zero_stock=False,
            current=int(args.get("page") or 1),
            page_size=min(int(args.get("page_size") or 20), 50),
        )
        return _truncate_tool_result(result)
