"""好力 GO — 厂内维保/维修单消息模板预设。"""

from __future__ import annotations

from typing import Any, Dict, List

from apps.haoligo.constants.message_template_codes import (
    HAOLIGO_MOLD_MAINTENANCE_APPROVED,
    HAOLIGO_MOLD_MAINTENANCE_PENDING,
    HAOLIGO_MOLD_MAINTENANCE_REJECTED,
    HAOLIGO_MOLD_MAINTENANCE_REVOKED,
)

MOLD_MAINTENANCE_DETAIL_PATH = "/apps/haoligo/molds/documents/upkeep"

MOLD_MAINTENANCE_COMMON_VARIABLES: Dict[str, str] = {
    "sheet_no": "维保单号",
    "service_type": "服务类型",
    "applicant_name": "申请人",
    "department_name": "申请部门",
    "mold_maintenance_sheet_id": "维保单 ID",
    "detail_path": "系统菜单路径",
}

HAOLIGO_MOLD_MAINTENANCE_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "厂内维保单待审核提醒",
        "code": HAOLIGO_MOLD_MAINTENANCE_PENDING,
        "type": "internal",
        "description": "厂内维保/维修单创建进入待审核时通知相关人员",
        "subject": "【厂内维保单·待审核】{sheet_no}",
        "content": (
            "您好，\n\n"
            "厂内维保单 {sheet_no} 已提交待审，服务类型：{service_type}，申请部门：{department_name}，申请人：{applicant_name}。\n\n"
            "请登录系统查看并审核。\n"
        ),
        "variables": {**MOLD_MAINTENANCE_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "厂内维保单审核通过通知",
        "code": HAOLIGO_MOLD_MAINTENANCE_APPROVED,
        "type": "internal",
        "description": "厂内维保/维修单审核通过时通知申请人",
        "subject": "【厂内维保单·已通过】{sheet_no}",
        "content": (
            "您好，\n\n"
            "厂内维保单 {sheet_no} 已审核通过，服务类型：{service_type}。\n\n"
            "请登录系统 → {detail_path} 查看明细。\n"
        ),
        "variables": {**MOLD_MAINTENANCE_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "厂内维保单审核驳回通知",
        "code": HAOLIGO_MOLD_MAINTENANCE_REJECTED,
        "type": "internal",
        "description": "厂内维保/维修单审核驳回时通知申请人",
        "subject": "【厂内维保单·已驳回】{sheet_no}",
        "content": (
            "您好，\n\n"
            "厂内维保单 {sheet_no} 已被驳回，请修改后重新提交。\n\n"
            "服务类型：{service_type}\n\n"
            "请登录系统 → {detail_path} 查看明细。\n"
        ),
        "variables": {**MOLD_MAINTENANCE_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "厂内维保单撤销审核通知",
        "code": HAOLIGO_MOLD_MAINTENANCE_REVOKED,
        "type": "internal",
        "description": "厂内维保/维修单撤销审核时通知相关人员",
        "subject": "【厂内维保单·撤销审核】{sheet_no}",
        "content": (
            "您好，\n\n"
            "厂内维保单 {sheet_no} 审核已撤销，单据回到待审核状态。\n\n"
            "服务类型：{service_type}\n\n"
            "请登录系统 → {detail_path} 查看明细。\n"
        ),
        "variables": {**MOLD_MAINTENANCE_COMMON_VARIABLES},
        "is_active": True,
    },
]


async def ensure_haoligo_mold_maintenance_message_templates(tenant_id: int) -> None:
    from apps.haoligo.services.haoligo_message_template_registry import load_haoligo_message_template_presets

    await load_haoligo_message_template_presets(
        tenant_id,
        only_codes={
            HAOLIGO_MOLD_MAINTENANCE_PENDING,
            HAOLIGO_MOLD_MAINTENANCE_APPROVED,
            HAOLIGO_MOLD_MAINTENANCE_REJECTED,
            HAOLIGO_MOLD_MAINTENANCE_REVOKED,
        },
    )
