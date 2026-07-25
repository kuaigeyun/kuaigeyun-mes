"""快制造 — 配置辅助（消息提醒规则预设等）。"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from apps.kuaizhizao.services.kuaizhizao_notification_rule_presets import (
    load_kuaizhizao_notification_rule_presets,
)
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/config", tags=["App - Kuaige Zhizao - 配置"])


class LoadNotificationRulePresetsOut(BaseModel):
    created: int = Field(description="本次新增规则数")
    updated: int = Field(description="本次合并预设收件范围的已有规则数")
    repaired_templates: int = Field(default=0, description="本次为已有规则补绑消息模板的条数")
    templates_created: int = Field(default=0, description="本次新建的消息模板预设条数")
    skipped_duplicate: int = Field(description="因已存在同单据+动作而跳过")
    skipped_missing_template: int = Field(description="因缺少消息模板而跳过")
    total_rules: int = Field(description="加载后规则总数")


@router.post(
    "/notification-rules/load-presets",
    response_model=LoadNotificationRulePresetsOut,
    summary="加载快制造消息提醒规则预设",
    dependencies=[Depends(require_permission_codes("system:message-template:create"))],
)
async def load_kuaizhizao_notification_rule_presets_api(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
):
    result = await load_kuaizhizao_notification_rule_presets(tenant_id)
    return LoadNotificationRulePresetsOut(**result)
