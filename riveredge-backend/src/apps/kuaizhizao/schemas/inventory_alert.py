"""
库存预警数据验证Schema模块

定义库存预警相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-04
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class InventoryAlertRuleBase(BaseModel):
    """
    库存预警规则基础Schema

    包含所有库存预警规则的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., description="预警规则名称")
    alert_type: str = Field(..., description="预警类型（low_stock/high_stock/expired）")
    material_id: Optional[int] = Field(None, description="物料ID（可选）")
    material_code: Optional[str] = Field(None, description="物料编码（可选）")
    material_name: Optional[str] = Field(None, description="物料名称（可选）")
    warehouse_id: Optional[int] = Field(None, description="仓库ID（可选）")
    warehouse_name: Optional[str] = Field(None, description="仓库名称（可选）")
    threshold_type: str = Field(..., description="阈值类型（quantity/percentage/days）")
    threshold_value: Decimal = Field(..., description="阈值数值")
    is_enabled: bool = Field(True, description="是否启用")
    notify_users: Optional[List[int]] = Field(None, description="通知用户ID列表")
    notify_roles: Optional[List[int]] = Field(None, description="通知角色ID列表")
    remarks: Optional[str] = Field(None, description="备注")


class InventoryAlertRuleCreate(InventoryAlertRuleBase):
    """
    库存预警规则创建Schema

    用于创建新库存预警规则的数据验证。
    """
    pass


class InventoryAlertRuleUpdate(BaseModel):
    """
    库存预警规则更新Schema

    用于更新库存预警规则的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, description="预警规则名称")
    threshold_type: Optional[str] = Field(None, description="阈值类型")
    threshold_value: Optional[Decimal] = Field(None, description="阈值数值")
    is_enabled: Optional[bool] = Field(None, description="是否启用")
    notify_users: Optional[List[int]] = Field(None, description="通知用户ID列表")
    notify_roles: Optional[List[int]] = Field(None, description="通知角色ID列表")
    remarks: Optional[str] = Field(None, description="备注")


class InventoryAlertRuleResponse(InventoryAlertRuleBase):
    """
    库存预警规则响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="预警规则ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="预警规则编码")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")


class InventoryAlertRuleListResponse(InventoryAlertRuleResponse):
    """
    库存预警规则列表响应Schema

    用于库存预警规则列表API的响应数据格式。
    """
    pass


class InventoryAlertBase(BaseModel):
    """
    库存预警记录基础Schema

    包含所有库存预警记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    alert_rule_id: Optional[int] = Field(None, description="预警规则ID")
    alert_type: str = Field(..., description="预警类型")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    warehouse_id: int = Field(..., description="仓库ID")
    warehouse_name: str = Field(..., description="仓库名称")
    current_quantity: Decimal = Field(..., description="当前库存数量")
    threshold_value: Decimal = Field(..., description="阈值数值")
    alert_level: str = Field("warning", description="预警级别")
    alert_message: str = Field(..., description="预警消息")


class InventoryAlertResponse(InventoryAlertBase):
    """
    库存预警记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="预警记录ID")
    uuid: str = Field(..., description="业务ID")
    status: str = Field(..., description="状态")
    handled_by: Optional[int] = Field(None, description="处理人ID")
    handled_by_name: Optional[str] = Field(None, description="处理人姓名")
    handled_at: Optional[datetime] = Field(None, description="处理时间")
    handling_notes: Optional[str] = Field(None, description="处理备注")
    triggered_at: datetime = Field(..., description="触发时间")
    resolved_at: Optional[datetime] = Field(None, description="解决时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class InventoryAlertListResponse(InventoryAlertResponse):
    """
    库存预警记录列表响应Schema

    用于库存预警记录列表API的响应数据格式。
    """
    pass


class InventoryAlertHandleRequest(BaseModel):
    """
    库存预警处理请求Schema

    用于处理库存预警的请求数据。
    """
    status: str = Field(..., description="处理状态（processing/resolved/ignored）")
    handling_notes: Optional[str] = Field(None, description="处理备注")

