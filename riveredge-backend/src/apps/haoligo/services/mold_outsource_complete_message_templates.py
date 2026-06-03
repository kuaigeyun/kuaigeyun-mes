"""好力 GO — 外协维保完修单消息模板预设。"""

from __future__ import annotations

from typing import Any, Dict, List

from apps.haoligo.constants.message_template_codes import (
    HAOLIGO_MOLD_OUTSOURCE_COMPLETE_APPROVED,
    HAOLIGO_MOLD_OUTSOURCE_COMPLETE_PENDING,
    HAOLIGO_MOLD_OUTSOURCE_COMPLETE_REJECTED,
)

OUTSOURCE_COMPLETE_DETAIL_PATH = "/apps/haoligo/molds/documents/outsource-complete"

OUTSOURCE_COMPLETE_COMMON_VARIABLES: Dict[str, str] = {
    "sheet_no": "完修单号",
    "source_order_no": "来源单号",
    "outsourced_unit_name": "外协单位",
    "applicant_name": "申请人",
    "service_type": "服务类型",
    "outsource_complete_sheet_id": "完修单 ID",
    "detail_path": "系统菜单路径",
}

HAOLIGO_MOLD_OUTSOURCE_COMPLETE_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "外协维保完修单待审核提醒",
        "code": HAOLIGO_MOLD_OUTSOURCE_COMPLETE_PENDING,
        "type": "internal",
        "description": "外协单位提交维修完成（完修单）时通知申请人及来源维保单相关人员",
        "subject": "【外协维修完成】{sheet_no}",
        "content": (
            "您好，\n\n"
            "外协单位已提交维修完成单 {sheet_no}，来源单号：{source_order_no}，外协单位：{outsourced_unit_name}，申请人：{applicant_name}。\n\n"
            "请登录系统 → {detail_path} 查看完修单并审核。\n"
        ),
        "variables": {**OUTSOURCE_COMPLETE_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "外协维保完修单审核通过通知",
        "code": HAOLIGO_MOLD_OUTSOURCE_COMPLETE_APPROVED,
        "type": "internal",
        "description": "外协维保完修单审核通过时通知申请人及外协绑定用户",
        "subject": "【外协完修单·已通过】{sheet_no}",
        "content": (
            "您好，\n\n"
            "外协维保完修单 {sheet_no} 已审核通过。\n\n"
            "外协单位：{outsourced_unit_name}\n"
            "来源单号：{source_order_no}\n\n"
            "请登录系统 → {detail_path} 查看明细。\n"
        ),
        "variables": {**OUTSOURCE_COMPLETE_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "外协维保完修单审核驳回通知",
        "code": HAOLIGO_MOLD_OUTSOURCE_COMPLETE_REJECTED,
        "type": "internal",
        "description": "外协维保完修单审核驳回时通知申请人",
        "subject": "【外协完修单·已驳回】{sheet_no}",
        "content": (
            "您好，\n\n"
            "外协维保完修单 {sheet_no} 已被驳回，请修改后重新提交。\n\n"
            "外协单位：{outsourced_unit_name}\n\n"
            "请登录系统 → {detail_path} 查看明细。\n"
        ),
        "variables": {**OUTSOURCE_COMPLETE_COMMON_VARIABLES},
        "is_active": True,
    },
]


async def ensure_haoligo_mold_outsource_complete_message_templates(tenant_id: int) -> None:
    from apps.haoligo.services.haoligo_message_template_registry import load_haoligo_message_template_presets

    await load_haoligo_message_template_presets(
        tenant_id,
        only_codes={
            HAOLIGO_MOLD_OUTSOURCE_COMPLETE_PENDING,
            HAOLIGO_MOLD_OUTSOURCE_COMPLETE_APPROVED,
            HAOLIGO_MOLD_OUTSOURCE_COMPLETE_REJECTED,
        },
    )
