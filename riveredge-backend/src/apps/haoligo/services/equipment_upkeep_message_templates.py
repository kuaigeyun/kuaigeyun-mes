"""好力 GO — 设备维保单/完修单消息模板预设。"""

from __future__ import annotations

from typing import Any, Dict, List

from apps.haoligo.constants.message_template_codes import (
    HAOLIGO_EQUIPMENT_UPKEEP_COMPLETE_CREATED,
    HAOLIGO_EQUIPMENT_UPKEEP_SHEET_CREATED,
)

EQUIPMENT_UPKEEP_SHEET_COMMON_VARIABLES: Dict[str, str] = {
    "sheet_no": "维保单号",
    "service_type": "服务类型",
    "applicant_name": "申请人",
    "department_name": "申请部门",
    "equipment_label": "设备",
    "equipment_upkeep_sheet_id": "维保单 ID",
}

EQUIPMENT_UPKEEP_COMPLETE_COMMON_VARIABLES: Dict[str, str] = {
    "sheet_no": "完修单号",
    "source_order_no": "来源单号",
    "service_type": "服务类型",
    "applicant_name": "申请人",
    "equipment_label": "设备",
    "equipment_upkeep_complete_sheet_id": "完修单 ID",
}

HAOLIGO_EQUIPMENT_UPKEEP_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "设备维保单创建通知",
        "code": HAOLIGO_EQUIPMENT_UPKEEP_SHEET_CREATED,
        "type": "internal",
        "description": "设备维保/维修单创建时通知申请人",
        "subject": "【设备维保单·已创建】{sheet_no}",
        "content": (
            "您好，\n\n"
            "设备维保单 {sheet_no} 已创建，服务类型：{service_type}，设备：{equipment_label}，申请人：{applicant_name}。\n\n"
            "请登录系统查看明细。\n"
        ),
        "variables": {**EQUIPMENT_UPKEEP_SHEET_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "设备维保完修单创建通知",
        "code": HAOLIGO_EQUIPMENT_UPKEEP_COMPLETE_CREATED,
        "type": "internal",
        "description": "设备维保完修单创建时通知申请人",
        "subject": "【设备完修单·已创建】{sheet_no}",
        "content": (
            "您好，\n\n"
            "设备维保完修单 {sheet_no} 已创建，来源单号：{source_order_no}，服务类型：{service_type}，设备：{equipment_label}。\n\n"
            "请登录系统查看明细。\n"
        ),
        "variables": {**EQUIPMENT_UPKEEP_COMPLETE_COMMON_VARIABLES},
        "is_active": True,
    },
]


async def ensure_haoligo_equipment_upkeep_message_templates(tenant_id: int) -> None:
    from apps.haoligo.services.haoligo_message_template_registry import load_haoligo_message_template_presets

    await load_haoligo_message_template_presets(
        tenant_id,
        only_codes={
            HAOLIGO_EQUIPMENT_UPKEEP_SHEET_CREATED,
            HAOLIGO_EQUIPMENT_UPKEEP_COMPLETE_CREATED,
        },
    )
