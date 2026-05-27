"""好力 GO — 设备相关消息模板预设与按租户补齐。"""

from __future__ import annotations

from typing import Any, Dict, List

from loguru import logger

from apps.haoligo.constants.message_template_codes import (
    HAOLIGO_EQUIPMENT_ROUTE_PATROL_REPORT,
    HAOLIGO_EQUIPMENT_SPOT_CHECK_REPORT,
)

SPOT_CHECK_REPORT_TEMPLATE_CONTENT = (
    "您好，\n\n"
    "设备点检单 {sheet_no} 已上报，请您关注并处理。\n\n"
    "设备：{equipment_label}\n"
    "点检时间：{recorded_at}\n"
    "填报人：{reporter_name}\n\n"
    "【点检异常项】\n"
    "{abnormal_items_summary}\n\n"
    "【设备运行状态】\n"
    "{equipment_status_change}\n\n"
    "请登录系统查看点检明细。"
)

SPOT_CHECK_REPORT_TEMPLATE_VARIABLES: Dict[str, str] = {
    "sheet_no": "点检单号",
    "equipment_label": "设备（编码+名称）",
    "equipment_asset_code": "设备编码",
    "equipment_name": "设备名称",
    "recorded_at": "点检时间",
    "reporter_name": "填报人",
    "spot_check_id": "点检单 ID",
    "abnormal_items_summary": "点检异常项（正常→异常及实测/说明）",
    "equipment_status_change": "设备运行状态变更（调整前→调整后）",
}

ROUTE_PATROL_REPORT_TEMPLATE_CONTENT = (
    "您好，\n\n"
    "路线巡检单 {sheet_no} 已上报，请您关注并处理。\n\n"
    "巡检路线：{patrol_route_label}\n"
    "巡检时间：{recorded_at}\n"
    "填报人：{reporter_name}\n\n"
    "【巡检异常设备】\n"
    "{abnormal_items_summary}\n\n"
    "【设备运行状态调整】\n"
    "{equipment_status_changes_summary}\n\n"
    "请登录系统查看巡检明细。"
)

ROUTE_PATROL_REPORT_TEMPLATE_VARIABLES: Dict[str, str] = {
    "sheet_no": "巡检单号",
    "patrol_route_label": "巡检路线（编码+名称）",
    "patrol_route_code": "路线编码",
    "patrol_route_name": "路线名称",
    "recorded_at": "巡检时间",
    "reporter_name": "填报人",
    "route_patrol_id": "巡检单 ID",
    "abnormal_items_summary": "异常设备（正常→异常及说明）",
    "equipment_status_changes_summary": "各设备运行状态变更（调整前→调整后）",
}

HAOLIGO_EQUIPMENT_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "设备点检异常上报",
        "code": HAOLIGO_EQUIPMENT_SPOT_CHECK_REPORT,
        "type": "internal",
        "description": "设备点检单保存并开启上报时，向所选接收人发送站内信",
        "subject": "【设备点检上报】{sheet_no}",
        "content": SPOT_CHECK_REPORT_TEMPLATE_CONTENT,
        "variables": SPOT_CHECK_REPORT_TEMPLATE_VARIABLES,
        "is_active": True,
    },
    {
        "name": "路线巡检异常上报",
        "code": HAOLIGO_EQUIPMENT_ROUTE_PATROL_REPORT,
        "type": "internal",
        "description": "路线巡检单保存并开启上报时，向所选接收人发送站内信",
        "subject": "【路线巡检上报】{sheet_no}",
        "content": ROUTE_PATROL_REPORT_TEMPLATE_CONTENT,
        "variables": ROUTE_PATROL_REPORT_TEMPLATE_VARIABLES,
        "is_active": True,
    },
]


async def ensure_haoligo_equipment_message_templates(tenant_id: int) -> int:
    """按租户补齐好力 GO 设备消息模板（已存在则跳过）。返回新建数量。"""
    from apps.haoligo.services.haoligo_message_template_registry import load_haoligo_message_template_presets

    only = {str(p["code"]) for p in HAOLIGO_EQUIPMENT_MESSAGE_TEMPLATE_PRESETS}
    return await load_haoligo_message_template_presets(tenant_id, only_codes=only)
