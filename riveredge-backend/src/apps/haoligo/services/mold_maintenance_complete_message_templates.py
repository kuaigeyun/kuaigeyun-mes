"""好力 GO — 厂内维保/维修完修单消息模板预设。"""

from __future__ import annotations

from typing import Any, Dict, List

from apps.haoligo.constants.message_template_codes import HAOLIGO_MOLD_MAINTENANCE_COMPLETE_CREATED

MOLD_MAINTENANCE_COMPLETE_COMMON_VARIABLES: Dict[str, str] = {
    "sheet_no": "完修单号",
    "source_order_no": "来源单号",
    "service_type": "服务类型",
    "applicant_name": "申请人",
    "mold_maintenance_complete_sheet_id": "完修单 ID",
}

HAOLIGO_MOLD_MAINTENANCE_COMPLETE_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "厂内维保完修单创建通知",
        "code": HAOLIGO_MOLD_MAINTENANCE_COMPLETE_CREATED,
        "type": "internal",
        "description": "厂内维保/维修完修单创建时通知申请人",
        "subject": "【厂内完修单·已创建】{sheet_no}",
        "content": (
            "您好，\n\n"
            "厂内维保完修单 {sheet_no} 已创建，来源单号：{source_order_no}，服务类型：{service_type}，申请人：{applicant_name}。\n\n"
            "请登录系统查看明细。\n"
        ),
        "variables": {**MOLD_MAINTENANCE_COMPLETE_COMMON_VARIABLES},
        "is_active": True,
    },
]


async def ensure_haoligo_mold_maintenance_complete_message_templates(tenant_id: int) -> None:
    from apps.haoligo.services.haoligo_message_template_registry import load_haoligo_message_template_presets

    await load_haoligo_message_template_presets(
        tenant_id,
        only_codes={HAOLIGO_MOLD_MAINTENANCE_COMPLETE_CREATED},
    )
