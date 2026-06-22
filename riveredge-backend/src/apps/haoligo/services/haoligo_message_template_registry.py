"""好力 GO — 消息模板预设统一注册（系统「加载预设」与业务侧 ensure 共用）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from loguru import logger

from apps.haoligo.services.equipment_message_templates import HAOLIGO_EQUIPMENT_MESSAGE_TEMPLATE_PRESETS
from apps.haoligo.services.outsource_maintenance_message_templates import (
    HAOLIGO_OUTSOURCE_MAINTENANCE_MESSAGE_TEMPLATE_PRESETS,
)
from apps.haoligo.services.patrol_message_templates import HAOLIGO_PATROL_MESSAGE_TEMPLATE_PRESETS
from apps.haoligo.services.equipment_upkeep_message_templates import (
    HAOLIGO_EQUIPMENT_UPKEEP_MESSAGE_TEMPLATE_PRESETS,
)
from apps.haoligo.services.equipment_output_message_templates import (
    HAOLIGO_EQUIPMENT_OUTPUT_MESSAGE_TEMPLATE_PRESETS,
)
from apps.haoligo.services.mold_maintenance_complete_message_templates import (
    HAOLIGO_MOLD_MAINTENANCE_COMPLETE_MESSAGE_TEMPLATE_PRESETS,
)
from apps.haoligo.services.mold_maintenance_message_templates import (
    HAOLIGO_MOLD_MAINTENANCE_MESSAGE_TEMPLATE_PRESETS,
)
from apps.haoligo.services.mold_outsource_complete_message_templates import (
    HAOLIGO_MOLD_OUTSOURCE_COMPLETE_MESSAGE_TEMPLATE_PRESETS,
)
from apps.haoligo.services.trial_message_templates import HAOLIGO_TRIAL_MESSAGE_TEMPLATE_PRESETS
from core.models.message_template import MessageTemplate
from core.schemas.message_template import MessageTemplateCreate
from core.services.messaging.message_template_service import MessageTemplateService

HAOLIGO_MESSAGE_TEMPLATE_PRESETS: List[Dict[str, Any]] = [
    *HAOLIGO_EQUIPMENT_MESSAGE_TEMPLATE_PRESETS,
    *HAOLIGO_PATROL_MESSAGE_TEMPLATE_PRESETS,
    *HAOLIGO_TRIAL_MESSAGE_TEMPLATE_PRESETS,
    *HAOLIGO_OUTSOURCE_MAINTENANCE_MESSAGE_TEMPLATE_PRESETS,
    *HAOLIGO_MOLD_MAINTENANCE_MESSAGE_TEMPLATE_PRESETS,
    *HAOLIGO_MOLD_MAINTENANCE_COMPLETE_MESSAGE_TEMPLATE_PRESETS,
    *HAOLIGO_MOLD_OUTSOURCE_COMPLETE_MESSAGE_TEMPLATE_PRESETS,
    *HAOLIGO_EQUIPMENT_UPKEEP_MESSAGE_TEMPLATE_PRESETS,
    *HAOLIGO_EQUIPMENT_OUTPUT_MESSAGE_TEMPLATE_PRESETS,
]


async def load_haoligo_message_template_presets(
    tenant_id: int,
    *,
    only_codes: Optional[Set[str]] = None,
) -> int:
    """按租户创建好力 GO 消息模板（已存在则跳过）。返回新建数量。"""
    created = 0
    for item in HAOLIGO_MESSAGE_TEMPLATE_PRESETS:
        code = str(item.get("code") or "").strip()
        if not code:
            continue
        if only_codes is not None and code not in only_codes:
            continue
        exists = await MessageTemplate.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True,
        ).exists()
        if exists:
            continue
        try:
            data = MessageTemplateCreate(
                name=item["name"],
                code=item["code"],
                type=item["type"],
                description=item.get("description"),
                subject=item.get("subject"),
                content=item["content"],
                variables=item.get("variables"),
                is_active=item.get("is_active", True),
            )
            await MessageTemplateService.create_message_template(tenant_id, data)
            created += 1
        except Exception as e:
            logger.warning("创建好力 GO 消息模板 {} 失败: {}", code, e)
    return created
