"""好力 GO — 设备验收单消息模板预设。"""

from __future__ import annotations

from typing import Any, Dict, List

from apps.haoligo.constants.message_template_codes import (
    HAOLIGO_EQUIPMENT_ACCEPTANCE_ACCEPTED,
    HAOLIGO_EQUIPMENT_ACCEPTANCE_TRIAL_FAILED,
    HAOLIGO_EQUIPMENT_ACCEPTANCE_TRIAL_PENDING,
)

ACCEPTANCE_COMMON_VARIABLES: Dict[str, str] = {
    "sheet_no": "验收单号",
    "equipment_name": "设备名称",
    "install_location": "安装位置",
    "manufacturer_name": "厂家",
    "round_no": "轮次",
    "equipment_acceptance_sheet_id": "验收单 ID",
}

HAOLIGO_EQUIPMENT_ACCEPTANCE_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "设备验收单·待试产",
        "code": HAOLIGO_EQUIPMENT_ACCEPTANCE_TRIAL_PENDING,
        "type": "internal",
        "description": "工程部提交试产时通知车间主任",
        "subject": "【设备验收·待试产】{sheet_no}",
        "content": (
            "您好，\n\n"
            "设备验收单 {sheet_no} 第 {round_no} 轮调试合格，设备：{equipment_name}，安装位置：{install_location}，"
            "厂家：{manufacturer_name}。\n\n"
            "请安排试产并登录系统填写试产数据。\n"
        ),
        "variables": {**ACCEPTANCE_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "设备验收单·试产不合格退回",
        "code": HAOLIGO_EQUIPMENT_ACCEPTANCE_TRIAL_FAILED,
        "type": "internal",
        "description": "试产不合格退回工程部调试",
        "subject": "【设备验收·试产不合格】{sheet_no}",
        "content": (
            "您好，\n\n"
            "设备验收单 {sheet_no} 第 {round_no} 轮试产不合格，设备：{equipment_name}。\n\n"
            "请工程部继续调试后重新提交试产。\n"
        ),
        "variables": {**ACCEPTANCE_COMMON_VARIABLES},
        "is_active": True,
    },
    {
        "name": "设备验收单·验收合格",
        "code": HAOLIGO_EQUIPMENT_ACCEPTANCE_ACCEPTED,
        "type": "internal",
        "description": "试产合格验收结案",
        "subject": "【设备验收·合格】{sheet_no}",
        "content": (
            "您好，\n\n"
            "设备验收单 {sheet_no} 已验收合格，设备：{equipment_name}，安装位置：{install_location}。\n\n"
            "请登录系统查看明细并完成台账关联（如尚未处理）。\n"
        ),
        "variables": {**ACCEPTANCE_COMMON_VARIABLES},
        "is_active": True,
    },
]


async def ensure_haoligo_equipment_acceptance_message_templates(tenant_id: int) -> None:
    from apps.haoligo.services.haoligo_message_template_registry import load_haoligo_message_template_presets

    await load_haoligo_message_template_presets(
        tenant_id,
        only_codes={
            HAOLIGO_EQUIPMENT_ACCEPTANCE_TRIAL_PENDING,
            HAOLIGO_EQUIPMENT_ACCEPTANCE_TRIAL_FAILED,
            HAOLIGO_EQUIPMENT_ACCEPTANCE_ACCEPTED,
        },
    )
