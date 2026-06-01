"""好力 GO — 试模单消息模板预设。"""

from __future__ import annotations

from typing import Any, Dict, List

from apps.haoligo.constants.message_template_codes import (
    HAOLIGO_MOLD_TRIAL_FAILURE_PENDING,
    HAOLIGO_MOLD_TRIAL_FAILURE_REPAIR,
)
TRIAL_DETAIL_PATH = "/apps/haoligo/molds/documents/trial"

TRIAL_FAILURE_COMMON_VARIABLES: Dict[str, str] = {
    "sheet_no": "试模单号",
    "purchase_order_no": "采购订单号",
    "mold_code": "模具代号",
    "mold_name": "模具名称",
    "supplier_name": "供应商",
    "trial_user_name": "试模人员",
    "trial_times": "试模次数",
    "failure_handling": "处理方式",
    "trial_sheet_id": "试模单 ID",
    "detail_path": "系统菜单路径",
}

TRIAL_FAILURE_PENDING_TEMPLATE_CONTENT = (
    "您好，\n\n"
    "试模单 {sheet_no} 试模结果为「不合格」，处理方式为「待处理」，请您关注并跟进。\n\n"
    "采购订单号：{purchase_order_no}\n"
    "模具代号：{mold_code}\n"
    "模具名称：{mold_name}\n"
    "供应商：{supplier_name}\n"
    "试模人员：{trial_user_name}\n"
    "第 {trial_times} 次试模\n\n"
    "说明：已向消息提醒人员发送本通知；外协厂商将在模具转出至外部仓后收到通知。\n\n"
    "请登录系统 → {detail_path} 查看试模单明细。"
)

TRIAL_FAILURE_REPAIR_TEMPLATE_CONTENT = (
    "您好，\n\n"
    "试模单 {sheet_no} 试模结果为「不合格」，已选择「立即送修」，模具台账所在仓库已转移至送修仓。\n\n"
    "采购订单号：{purchase_order_no}\n"
    "模具代号：{mold_code}\n"
    "模具名称：{mold_name}\n"
    "供应商：{supplier_name}\n"
    "试模人员：{trial_user_name}\n"
    "第 {trial_times} 次试模\n"
    "送修仓库：{repair_warehouse_name}\n\n"
    "请登录系统 → {detail_path} 查看试模单明细。"
)

HAOLIGO_TRIAL_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    {
        "name": "试模不合格待处理提醒",
        "code": HAOLIGO_MOLD_TRIAL_FAILURE_PENDING,
        "type": "internal",
        "description": "试模不合格且选择「待处理」时，向消息提醒人员发送站内信（外协厂商在发出转仓后收到通知）",
        "subject": "【试模不合格·待处理】{sheet_no}",
        "content": TRIAL_FAILURE_PENDING_TEMPLATE_CONTENT,
        "variables": {
            **TRIAL_FAILURE_COMMON_VARIABLES,
        },
        "is_active": True,
    },
    {
        "name": "试模不合格立即送修通知",
        "code": HAOLIGO_MOLD_TRIAL_FAILURE_REPAIR,
        "type": "internal",
        "description": "试模不合格且选择「立即送修」时，向试模人员及供应商绑定用户发送站内信",
        "subject": "【试模不合格·立即送修】{sheet_no}",
        "content": TRIAL_FAILURE_REPAIR_TEMPLATE_CONTENT,
        "variables": {
            **TRIAL_FAILURE_COMMON_VARIABLES,
            "repair_warehouse_name": "送修仓库",
        },
        "is_active": True,
    },
]


async def ensure_haoligo_trial_message_templates(tenant_id: int) -> None:
    from apps.haoligo.services.haoligo_message_template_registry import load_haoligo_message_template_presets

    await load_haoligo_message_template_presets(
        tenant_id,
        only_codes={
            HAOLIGO_MOLD_TRIAL_FAILURE_PENDING,
            HAOLIGO_MOLD_TRIAL_FAILURE_REPAIR,
        },
    )
