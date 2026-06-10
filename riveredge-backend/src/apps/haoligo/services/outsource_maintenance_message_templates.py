"""好力 GO — 外协维保单消息模板预设。"""

from __future__ import annotations

from typing import Any, Dict, List

from apps.haoligo.constants.message_template_codes import (
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_APPROVED,
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_PENDING,
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REJECTED,
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REVOKED,
)

OUTSOURCE_MAINTENANCE_DETAIL_PATH = "/apps/haoligo/molds/documents/outsource-maintenance"

OUTSOURCE_MAINTENANCE_COMMON_VARIABLES: Dict[str, str] = {
    "sheet_no": "维保单号",
    "outsourced_unit_name": "外协单位",
    "applicant_name": "申请人",
    "service_type": "服务类型",
    "outsource_maintenance_sheet_id": "维保单 ID",
    "detail_path": "系统菜单路径",
}

HAOLIGO_OUTSOURCE_MAINTENANCE_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "外协维保单待审核提醒",
        "code": HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_PENDING,
        "type": "internal",
        "description": "外协维保单提交或驳回后重提进入待审核时，通知外协单位绑定用户",
        "subject": "【外协维保单·待处理】{sheet_no}",
        "content": (
            "您好，\n\n"
            "外协维保单 {sheet_no} 已提交，服务类型：{service_type}，外协单位：{outsourced_unit_name}，申请人：{applicant_name}。\n\n"
            "请登录系统 → {detail_path} 查看明细并跟进。\n"
        ),
        "variables": {**OUTSOURCE_MAINTENANCE_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "外协维保单审核通过通知",
        "code": HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_APPROVED,
        "type": "internal",
        "description": "外协维保单审核通过时通知申请人及外协单位绑定用户",
        "subject": "【外协维保单·已通过】{sheet_no}",
        "content": (
            "您好，\n\n"
            "外协维保单 {sheet_no} 已审核通过，模具已转至外协仓库。\n\n"
            "外协单位：{outsourced_unit_name}\n"
            "服务类型：{service_type}\n\n"
            "请登录系统 → {detail_path} 查看明细。\n"
        ),
        "variables": {**OUTSOURCE_MAINTENANCE_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "外协维保单审核驳回通知",
        "code": HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REJECTED,
        "type": "internal",
        "description": "外协维保单审核驳回时通知申请人",
        "subject": "【外协维保单·已驳回】{sheet_no}",
        "content": (
            "您好，\n\n"
            "外协维保单 {sheet_no} 已被驳回，请修改后重新提交。\n\n"
            "外协单位：{outsourced_unit_name}\n"
            "服务类型：{service_type}\n\n"
            "请登录系统 → {detail_path} 查看明细。\n"
        ),
        "variables": {**OUTSOURCE_MAINTENANCE_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "外协维保单撤销审核通知",
        "code": HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REVOKED,
        "type": "internal",
        "description": "外协维保单撤销审核时通知相关人员",
        "subject": "【外协维保单·撤销审核】{sheet_no}",
        "content": (
            "您好，\n\n"
            "外协维保单 {sheet_no} 审核已撤销，单据回到待审核状态。\n\n"
            "外协单位：{outsourced_unit_name}\n\n"
            "请登录系统 → {detail_path} 查看明细。\n"
        ),
        "variables": {**OUTSOURCE_MAINTENANCE_COMMON_VARIABLES},
        "is_active": True,
    },
]


async def ensure_haoligo_outsource_maintenance_message_templates(tenant_id: int) -> None:
    from apps.haoligo.services.haoligo_message_template_registry import load_haoligo_message_template_presets

    await load_haoligo_message_template_presets(
        tenant_id,
        only_codes={
            HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_PENDING,
            HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_APPROVED,
            HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REJECTED,
            HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REVOKED,
        },
    )
