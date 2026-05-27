"""好力 GO — 现场巡查消息模板预设与按租户补齐。"""

from __future__ import annotations

from typing import Any, Dict, List

from loguru import logger

from apps.haoligo.constants.message_template_codes import HAOLIGO_PATROL_ISSUE_REGISTER_REPORT

PATROL_ISSUE_REGISTER_REPORT_TEMPLATE_CONTENT = (
    "您好，\n\n"
    "现场巡查问题已登记并上报，请您关注并处理。\n\n"
    "登记单号：{hazard_ref}\n"
    "车间：{workshop_name}\n"
    "巡查区域：{workshop_area}\n"
    "巡查时间：{reported_at}\n"
    "问题类型：{issue_type_label}\n"
    "登记人：{registrant_name}\n"
    "责任人：{responsible_name}\n"
    "关联设备：{equipment_label}\n\n"
    "请登录系统查看「隐患治理」处理进度。"
)

PATROL_ISSUE_REGISTER_REPORT_TEMPLATE_VARIABLES: Dict[str, str] = {
    "hazard_ref": "登记单号（业务单号）",
    "hazard_id": "隐患单 ID",
    "workshop_name": "车间名称",
    "workshop_area": "巡查区域",
    "reported_at": "巡查时间",
    "issue_type_label": "问题类型（字典显示名）",
    "issue_type_code": "问题类型编码",
    "registrant_name": "登记人",
    "responsible_name": "责任人",
    "equipment_label": "关联设备（编码+名称）",
}

HAOLIGO_PATROL_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "现场巡查问题登记上报",
        "code": HAOLIGO_PATROL_ISSUE_REGISTER_REPORT,
        "type": "internal",
        "description": "问题登记保存并开启上报时，向所选接收人发送站内信",
        "subject": "【现场巡查上报】{hazard_ref}",
        "content": PATROL_ISSUE_REGISTER_REPORT_TEMPLATE_CONTENT,
        "variables": PATROL_ISSUE_REGISTER_REPORT_TEMPLATE_VARIABLES,
        "is_active": True,
    },
]


async def ensure_haoligo_patrol_message_templates(tenant_id: int) -> int:
    """按租户补齐好力 GO 现场巡查消息模板（已存在则跳过）。返回新建数量。"""
    from apps.haoligo.services.haoligo_message_template_registry import load_haoligo_message_template_presets

    only = {str(p["code"]) for p in HAOLIGO_PATROL_MESSAGE_TEMPLATE_PRESETS}
    return await load_haoligo_message_template_presets(tenant_id, only_codes=only)
