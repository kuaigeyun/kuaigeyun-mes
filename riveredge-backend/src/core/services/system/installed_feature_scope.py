"""
按租户已安装且可见的应用代码，过滤系统管理类列表（编码规则页面、自定义字段、打印模板等）。

与 ApplicationService.get_installed_applications 对齐：已卸载、停用、占位应用不会出现在 installed 集合中。
"""

from __future__ import annotations

from functools import reduce
from operator import or_
from typing import Dict, FrozenSet, List, Optional, Set

from tortoise.expressions import Q

from core.services.application.application_service import ApplicationService

# 与后端 src/apps/*/manifest.json 的 code 对齐（用于表名前缀与路由 /apps/{code}/）
KNOWN_MANIFEST_APP_CODES: FrozenSet[str] = frozenset(
    {
        "master-data",
        "kuaizhizao",
        "haoligo",
        "kuaicaiwu",
        "kuaiai",
        "kuaireport",
        "kuaiiot",
        "kuaimes",
        "kuaierp",
    }
)

# 打印模板 config.document_type：与业务单据跟踪注册表一致（见 document_tracking_service.DOCUMENT_TYPE_LABEL_ZH）
_PRINT_DOC_KUAICAIWU: FrozenSet[str] = frozenset(
    {"receivable", "payable", "sales_invoice", "receipt", "payment", "purchase_invoice"}
)
_PRINT_DOC_MASTER_DATA: FrozenSet[str] = frozenset(
    {"performance_skill", "performance_holiday", "performance_summary"}
)
_PRINT_DOC_GLOBAL: FrozenSet[str] = frozenset({"label", "receipt"})
_PRINT_DOC_KUAIZHIZAO: FrozenSet[str] = frozenset(
    {
        "demand",
        "sales_order",
        "work_order",
        "purchase_order",
        "demand_computation",
        "sales_forecast",
        "production_plan",
        "purchase_requisition",
        "quotation",
        "rework_order",
        "purchase_receipt",
        "purchase_return",
        "sales_delivery",
        "incoming_inspection",
        "process_inspection",
        "finished_goods_inspection",
        "production_return",
        "production_picking",
        "finished_goods_receipt",
        "semi_finished_goods_receipt",
        "other_outbound",
        "other_inbound",
        "material_return",
        "shipment_notice",
        "delivery_notice",
        "reporting_record",
        "reporting_timeline",
        "outsource_order",
        "outsource_work_order",
        "packing_binding",
        "receipt_notice",
        "sales_return",
        "equipment",
        "equipment_fault",
        "maintenance_plan",
        "maintenance_reminder",
        "mold",
        "tool",
    }
)

# 系统数据字典 code → 至少需安装其一才在管理列表中展示
_SYSTEM_DICTIONARY_REQUIRES_APPS: Dict[str, FrozenSet[str]] = {
    "MATERIAL_TYPE": frozenset({"master-data"}),
    "MATERIAL_UNIT": frozenset({"master-data"}),
    "INDUSTRY_SECTOR": frozenset({"master-data"}),
    "PARTNER_SOURCE_CHANNEL": frozenset({"master-data"}),
    "CUSTOMER_LEVEL": frozenset({"master-data"}),
    "CUSTOMER_CATEGORY": frozenset({"master-data"}),
    "CONTACT_TITLE": frozenset({"master-data"}),
    "SALES_FOLLOW_UP_TYPE": frozenset({"master-data"}),
    "SHIPPING_METHOD": frozenset({"kuaizhizao"}),
    "PAYMENT_TERMS": frozenset({"kuaizhizao"}),
    "ORDER_TYPE": frozenset({"kuaizhizao"}),
    "RETURN_REASON": frozenset({"kuaizhizao"}),
    "RETURN_TYPE": frozenset({"kuaizhizao"}),
    "FEE_TYPE": frozenset({"kuaizhizao"}),
    "MATERIAL_CALL_TYPE": frozenset({"kuaizhizao"}),
    "MATERIAL_CALL_REASON": frozenset({"kuaizhizao"}),
    "WORK_ORDER_PRIORITY": frozenset({"kuaizhizao"}),
    "EQUIPMENT_TYPE": frozenset({"haoligo"}),
    "MOLD_TYPE": frozenset({"haoligo"}),
    "TOOL_TYPE": frozenset({"haoligo"}),
    "EQUIPMENT_STATUS": frozenset({"haoligo"}),
    "MOLD_STATUS": frozenset({"haoligo"}),
    "HAOLIGO_EQUIPMENT_OPERATIONAL_STATUS": frozenset({"haoligo"}),
    "HAOLIGO_EQUIPMENT_REPAIR_REASON": frozenset({"haoligo"}),
    "HAOLIGO_EQUIPMENT_MAINTENANCE_REASON": frozenset({"haoligo"}),
    "HAOLIGO_MOLD_REPAIR_REASON": frozenset({"haoligo"}),
    "HAOLIGO_MOLD_MAINTENANCE_REASON": frozenset({"haoligo"}),
    "HAOLIGO_PATROL_ISSUE_TYPE": frozenset({"haoligo"}),
    "TOOL_STATUS": frozenset({"haoligo"}),
}

_SYSTEM_DICTIONARY_ALWAYS_VISIBLE: FrozenSet[str] = frozenset({"CURRENCY", "TIMEZONE"})

# 与 ApprovalProcessService.CANONICAL_PROCESS_NAMES 中「快制造」域一致；个人任务保留为全局
KUAIZHIZAO_APPROVAL_PROCESS_CODES: FrozenSet[str] = frozenset(
    {
        "demand",
        "sales_forecast",
        "sales_order",
        "quotation",
        "production_plan",
        "purchase_request",
        "purchase_order",
        "reporting_record",
        "quality_inspection",
        "incoming_inspection",
        "process_inspection",
        "finished_goods_inspection",
        "sales_delivery",
        "purchase_receipt",
        "finished_goods_receipt",
        "other_inbound",
        "other_outbound",
        "production_picking",
        "production_return",
        "material_borrow",
        "material_return",
        "sales_return",
        "purchase_return",
        "demand_audit",
        "purchase_receipt_audit",
        "other_outbound_audit",
        "finished_goods_inspection_audit",
        "process_inspection_audit",
        "production_picking_audit",
        "quality_inspection_audit",
        "production_return_audit",
        "material_return_audit",
        "incoming_inspection_audit",
        "purchase_return_audit",
        "sales_delivery_audit",
        "material_borrow_audit",
        "finished_goods_receipt_audit",
        "sales_return_audit",
        "production_plan_audit",
        "quotation_audit",
    }
)

_MESSAGE_TEMPLATE_REQUIRES_APPS: Dict[str, FrozenSet[str]] = {
    # 审批通知模板目前仅在快制造审批流程域内使用
    "approval_approved": frozenset({"kuaizhizao"}),
    "approval_rejected": frozenset({"kuaizhizao"}),
}

# 邮件类全局预设已下线（邮件渠道未建设）；无「始终加载」的核心模板
_MESSAGE_TEMPLATE_ALWAYS_VISIBLE: FrozenSet[str] = frozenset()

_MESSAGE_TEMPLATE_CODE_PREFIX_TO_APP: Dict[str, str] = {
    "HAOLIGO_": "haoligo",
    "KUAIZHIZAO_": "kuaizhizao",
    "KUAICAIWU_": "kuaicaiwu",
    "MASTER_DATA_": "master-data",
}


async def get_installed_application_codes(tenant_id: int) -> Set[str]:
    apps = await ApplicationService.get_installed_applications(tenant_id)
    return {str(a["code"]) for a in apps if a.get("code")}


def app_code_from_page_path(page_path: Optional[str]) -> Optional[str]:
    if not page_path or not isinstance(page_path, str):
        return None
    p = page_path.strip()
    if not p.startswith("/apps/"):
        return None
    rest = p[len("/apps/") :].strip("/")
    if not rest:
        return None
    return rest.split("/", 1)[0]


def is_page_path_in_installed_apps(page_path: Optional[str], installed: Set[str]) -> bool:
    seg = app_code_from_page_path(page_path)
    if seg is None:
        return True
    return seg in installed


def table_storage_prefixes_for_manifest_app(app_code: str) -> tuple[str, ...]:
    if app_code == "master-data":
        return ("master_data_",)
    unders = app_code.replace("-", "_")
    return (f"apps_{unders}_",)


def custom_field_table_visibility_q(installed: Set[str]) -> Q:
    """排除属于未安装应用的表前缀（与 manifest code / ORM 表名约定一致）。"""
    clauses: List[Q] = []
    for app_code in KNOWN_MANIFEST_APP_CODES:
        if app_code in installed:
            continue
        for prefix in table_storage_prefixes_for_manifest_app(app_code):
            clauses.append(~Q(table_name__startswith=prefix))
    if not clauses:
        return Q()
    return reduce(lambda a, b: a & b, clauses)


def data_dictionary_list_visibility_q(installed: Set[str]) -> Q:
    """系统字典按归属应用过滤；非系统字典与未声明归属的系统字典始终列出。"""
    parts: List[Q] = [Q(is_system=False)]
    parts.append(Q(is_system=True, code__in=_SYSTEM_DICTIONARY_ALWAYS_VISIBLE))
    for code, req in _SYSTEM_DICTIONARY_REQUIRES_APPS.items():
        if installed & req:
            parts.append(Q(is_system=True, code=code))
    return reduce(or_, parts)


def system_dictionary_codes_for_installed_apps(installed: Set[str]) -> Set[str]:
    """基于已启用应用，计算应可见/可初始化的系统字典 code 集合。"""
    visible: Set[str] = set(_SYSTEM_DICTIONARY_ALWAYS_VISIBLE)
    for code, req in _SYSTEM_DICTIONARY_REQUIRES_APPS.items():
        if installed & req:
            visible.add(code)
    return visible


def code_rule_disallowed_rule_codes(installed: Set[str]) -> Set[str]:
    from core.config.code_rule_pages import CODE_RULE_PAGES

    out: Set[str] = set()
    for page in CODE_RULE_PAGES:
        if is_page_path_in_installed_apps(page.get("page_path"), installed):
            continue
        rc = page.get("rule_code")
        if rc:
            out.add(str(rc))
        pc = page.get("page_code") or ""
        out.add(str(pc).upper().replace("-", "_"))
    return out


def print_template_visible_for_installed_apps(
    config: Optional[dict], installed: Set[str]
) -> bool:
    if not config or not isinstance(config, dict):
        return True
    raw = config.get("document_type")
    if raw is None or raw == "":
        return True
    if not isinstance(raw, str):
        return True
    dt = raw.strip()
    if dt in _PRINT_DOC_GLOBAL:
        return True
    if dt in _PRINT_DOC_KUAICAIWU:
        return "kuaicaiwu" in installed
    if dt in _PRINT_DOC_MASTER_DATA:
        return "master-data" in installed
    if dt in _PRINT_DOC_KUAIZHIZAO:
        return "kuaizhizao" in installed
    return True


def approval_process_code_visible_for_installed_apps(code: str, installed: Set[str]) -> bool:
    """审批流程 code 按已启用应用可见性判断（未知 code 默认可见）。"""
    normalized = (code or "").strip()
    if not normalized:
        return True
    if normalized in KUAIZHIZAO_APPROVAL_PROCESS_CODES:
        return "kuaizhizao" in installed
    return True


def approval_process_codes_for_installed_apps(installed: Set[str]) -> Set[str]:
    """按已启用应用计算可初始化的审批流程 code 集合。"""
    visible: Set[str] = {"personal_task"}
    if "kuaizhizao" in installed:
        visible.update(KUAIZHIZAO_APPROVAL_PROCESS_CODES)
    return visible


def message_template_code_visible_for_installed_apps(code: str, installed: Set[str]) -> bool:
    """消息模板 code 按已启用应用可见性判断（未知 code 默认可见）。"""
    normalized = (code or "").strip()
    if not normalized:
        return True
    if normalized in _MESSAGE_TEMPLATE_ALWAYS_VISIBLE:
        return True
    req = _MESSAGE_TEMPLATE_REQUIRES_APPS.get(normalized)
    if not req:
        # 历史模板没有显式映射时，按 code 前缀推断归属应用（例如 HAOLIGO_*）。
        upper_code = normalized.upper()
        for prefix, app_code in _MESSAGE_TEMPLATE_CODE_PREFIX_TO_APP.items():
            if upper_code.startswith(prefix):
                return app_code in installed
        return True
    return bool(installed & req)


def message_template_codes_for_installed_apps(installed: Set[str]) -> Set[str]:
    """按已启用应用计算可初始化的消息模板 code 集合。"""
    visible: Set[str] = set(_MESSAGE_TEMPLATE_ALWAYS_VISIBLE)
    for code, req in _MESSAGE_TEMPLATE_REQUIRES_APPS.items():
        if installed & req:
            visible.add(code)
    return visible
