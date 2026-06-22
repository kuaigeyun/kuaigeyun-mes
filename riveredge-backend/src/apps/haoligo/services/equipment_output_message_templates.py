"""好力 GO — 设备产出单消息模板预设。"""

from __future__ import annotations

from typing import Any, Dict, List

from apps.haoligo.constants.message_template_codes import HAOLIGO_EQUIPMENT_OUTPUT_RECORD_CREATED

EQUIPMENT_OUTPUT_RECORD_COMMON_VARIABLES: Dict[str, str] = {
    "sheet_no": "产出单号",
    "equipment_label": "设备",
    "work_order_no": "制令单号",
    "finished_product_code": "成品代号",
    "finished_product_name": "成品名称",
    "planned_qty": "计划数量",
    "completed_qty": "完成数量",
    "recorded_at": "记录时间",
    "operator_name": "作业人员",
    "team_leader_name": "组长",
    "reporter_name": "填报人",
    "equipment_output_record_id": "产出单 ID",
}

HAOLIGO_EQUIPMENT_OUTPUT_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "设备产出单保存通知",
        "code": HAOLIGO_EQUIPMENT_OUTPUT_RECORD_CREATED,
        "type": "internal",
        "description": "设备产出单保存时向所选通知人员发送站内信",
        "subject": "【设备产出单·已保存】{sheet_no}",
        "content": (
            "您好，\n\n"
            "设备产出单 {sheet_no} 已保存。\n\n"
            "设备：{equipment_label}\n"
            "制令单号：{work_order_no}\n"
            "成品：{finished_product_code} {finished_product_name}\n"
            "计划数量：{planned_qty}，完成数量：{completed_qty}\n"
            "记录时间：{recorded_at}\n"
            "作业人员：{operator_name}，组长：{team_leader_name}\n"
            "填报人：{reporter_name}\n\n"
            "请登录系统查看明细。\n"
        ),
        "variables": {**EQUIPMENT_OUTPUT_RECORD_COMMON_VARIABLES},
        "is_active": True,
    },
]


async def ensure_haoligo_equipment_output_message_templates(tenant_id: int) -> None:
    from apps.haoligo.services.haoligo_message_template_registry import load_haoligo_message_template_presets

    await load_haoligo_message_template_presets(
        tenant_id,
        only_codes={HAOLIGO_EQUIPMENT_OUTPUT_RECORD_CREATED},
    )
