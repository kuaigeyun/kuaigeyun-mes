"""审核单据绑定 Schema"""

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class AuditBindingItemResponse(BaseModel):
    """单条审核绑定（含 manifest 声明信息）"""

    node_key: str
    entity_type: str
    resource: str
    name: str
    app: str
    config_category: str
    template: str
    is_enabled: bool
    process_uuid: Optional[UUID] = None
    process_name: Optional[str] = None
    process_code: Optional[str] = None


class AuditProcessOptionResponse(BaseModel):
    """可选审批流程（流程库）"""

    uuid: UUID
    name: str
    code: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class AuditBindingListResponse(BaseModel):
    """审核设置列表"""

    items: List[AuditBindingItemResponse]
    process_options: List[AuditProcessOptionResponse]


class AuditBindingUpdateRequest(BaseModel):
    """更新审核绑定"""

    is_enabled: Optional[bool] = Field(None, description="是否启用人工审核")
    process_uuid: Optional[UUID] = Field(None, description="绑定的审批流程 UUID")
