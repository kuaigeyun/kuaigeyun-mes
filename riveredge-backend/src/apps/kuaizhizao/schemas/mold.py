"""
模具 Schema 模块

定义模具和模具使用记录相关的 Pydantic Schema，用于 API 请求和响应验证。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime, date
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator

from apps.kuaizhizao.constants.mold_status import (
    MOLD_STATUS_PENDING_ACTIVATION,
    validate_mold_status,
)


class MoldBase(BaseModel):
    """
    模具基础 Schema
    
    包含模具的基本字段，用于创建和更新操作。
    """
    code: Optional[str] = Field(None, max_length=50, description="模具编码（可选，创建时自动生成）")
    name: str = Field(..., min_length=1, max_length=200, description="模具名称")
    type: Optional[str] = Field(None, max_length=50, description="模具类型（注塑模具、压铸模具、冲压模具、其他）")
    category: Optional[str] = Field(None, max_length=50, description="模具分类")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    serial_number: Optional[str] = Field(None, max_length=100, description="序列号")
    manufacturer: Optional[str] = Field(None, max_length=200, description="制造商")
    supplier: Optional[str] = Field(None, max_length=200, description="供应商")
    purchase_date: Optional[date] = Field(None, description="采购日期")
    installation_date: Optional[date] = Field(None, description="安装日期")
    warranty_period: Optional[int] = Field(None, ge=0, description="保修期（月）")
    technical_parameters: Optional[Dict[str, Any]] = Field(None, description="技术参数（JSON格式）")
    status: str = Field(default=MOLD_STATUS_PENDING_ACTIVATION, max_length=50, description="模具状态")
    is_active: bool = Field(default=True, description="是否启用")
    storage_location: Optional[str] = Field(None, max_length=200, description="存放位置")
    maintenance_scheme_id: Optional[int] = Field(None, description="默认保养方案ID")
    repair_scheme_id: Optional[int] = Field(None, description="默认维修方案ID")
    last_maintenance_date: Optional[date] = Field(None, description="上次保养日期")
    allow_repeated_borrow: bool = Field(default=False, description="是否允许重复领用")
    maintenance_interval: Optional[int] = Field(None, ge=1, description="保养间隔（使用次数）")
    needs_calibration: bool = Field(default=False, description="是否需要校验")
    calibration_period: Optional[int] = Field(None, ge=1, description="校验周期（天）")
    cavity_count: Optional[int] = Field(None, ge=1, description="腔数/模数，一次成型产出件数")
    design_lifetime: Optional[int] = Field(None, ge=1, description="设计寿命（使用次数），用于寿命预警")
    description: Optional[str] = Field(None, description="描述")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        return validate_mold_status(v)


class MoldCreate(MoldBase):
    """
    模具创建 Schema
    
    用于创建新模具的请求数据。
    """
    pass


class MoldUpdate(BaseModel):
    """
    模具更新 Schema
    
    用于更新模具的请求数据，所有字段可选。
    """
    code: Optional[str] = Field(None, max_length=50, description="模具编码")
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="模具名称")
    type: Optional[str] = Field(None, max_length=50, description="模具类型")
    category: Optional[str] = Field(None, max_length=50, description="模具分类")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    serial_number: Optional[str] = Field(None, max_length=100, description="序列号")
    manufacturer: Optional[str] = Field(None, max_length=200, description="制造商")
    supplier: Optional[str] = Field(None, max_length=200, description="供应商")
    purchase_date: Optional[date] = Field(None, description="采购日期")
    installation_date: Optional[date] = Field(None, description="安装日期")
    warranty_period: Optional[int] = Field(None, ge=0, description="保修期（月）")
    technical_parameters: Optional[Dict[str, Any]] = Field(None, description="技术参数（JSON格式）")
    status: Optional[str] = Field(None, max_length=50, description="模具状态")
    is_active: Optional[bool] = Field(None, description="是否启用")
    storage_location: Optional[str] = Field(None, max_length=200, description="存放位置")
    maintenance_scheme_id: Optional[int] = Field(None, description="默认保养方案ID")
    repair_scheme_id: Optional[int] = Field(None, description="默认维修方案ID")
    last_maintenance_date: Optional[date] = Field(None, description="上次保养日期")
    allow_repeated_borrow: Optional[bool] = Field(None, description="是否允许重复领用")
    maintenance_interval: Optional[int] = Field(None, ge=1, description="保养间隔（使用次数）")
    needs_calibration: Optional[bool] = Field(None, description="是否需要校验")
    calibration_period: Optional[int] = Field(None, ge=1, description="校验周期（天）")
    cavity_count: Optional[int] = Field(None, ge=1, description="腔数/模数")
    design_lifetime: Optional[int] = Field(None, ge=1, description="设计寿命（使用次数）")
    description: Optional[str] = Field(None, description="描述")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return validate_mold_status(v)


class MoldResponse(MoldBase):
    """
    模具响应 Schema
    
    用于返回模具信息的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    uuid: str = Field(..., description="模具UUID（对外暴露，业务标识）")
    id: int = Field(..., description="模具ID（内部使用）")
    tenant_id: int = Field(..., description="组织ID")
    total_usage_count: int = Field(default=0, description="累计使用次数")
    storage_location: Optional[str] = Field(None, description="存放位置")
    maintenance_scheme_id: Optional[int] = Field(None, description="默认保养方案ID")
    repair_scheme_id: Optional[int] = Field(None, description="默认维修方案ID")
    last_maintenance_date: Optional[date] = Field(None, description="上次保养日期")
    allow_repeated_borrow: bool = Field(default=False, description="是否允许重复领用")
    cavity_count: Optional[int] = Field(None, description="腔数/模数")
    design_lifetime: Optional[int] = Field(None, description="设计寿命（使用次数）")
    maintenance_interval: Optional[int] = Field(None, description="保养间隔（使用次数）")
    needs_calibration: bool = Field(default=False, description="是否需要校验")
    calibration_period: Optional[int] = Field(None, description="校验周期（天）")
    last_calibration_date: Optional[date] = Field(None, description="上次校验日期")
    next_calibration_date: Optional[date] = Field(None, description="下次校验日期")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间（软删除）")


class MoldListResponse(BaseModel):
    """
    模具列表响应 Schema
    
    用于返回模具列表的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    items: list[MoldResponse] = Field(..., description="模具列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


# ========== 模具校验记录 Schema ==========


class MoldCalibrationCreate(BaseModel):
    """
    模具校验记录创建 Schema
    """
    mold_uuid: str = Field(..., description="模具UUID")
    calibration_date: date = Field(..., description="校验日期")
    result: str = Field(..., max_length=50, description="校验结果（合格、不合格、准用）")
    certificate_no: Optional[str] = Field(None, max_length=100, description="证书编号")
    expiry_date: Optional[date] = Field(None, description="有效期至")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    remark: Optional[str] = Field(None, description="备注")


class MoldCalibrationResponse(BaseModel):
    """
    模具校验记录响应 Schema
    """
    model_config = ConfigDict(from_attributes=True)

    uuid: str = Field(..., description="校验记录UUID")
    id: int = Field(..., description="校验记录ID")
    mold_uuid: str = Field(..., description="模具UUID")
    mold_code: Optional[str] = Field(None, description="模具编码")
    mold_name: Optional[str] = Field(None, description="模具名称")
    calibration_date: date = Field(..., description="校验日期")
    result: str = Field(..., description="校验结果")
    certificate_no: Optional[str] = Field(None, description="证书编号")
    expiry_date: Optional[date] = Field(None, description="有效期至")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    remark: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(..., description="创建时间")


class MoldMaintenanceReminderResponse(BaseModel):
    """
    模具保养提醒响应 Schema（基于使用次数或天数）
    """
    mold_uuid: str = Field(..., description="模具UUID")
    mold_code: str = Field(..., description="模具编码")
    mold_name: str = Field(..., description="模具名称")
    trigger_type: str = Field(..., description="触发类型 days/usage_count")
    total_usage_count: Optional[int] = Field(None, description="当前累计使用次数")
    maintenance_interval: Optional[int] = Field(None, description="保养间隔（使用次数）")
    next_maintenance_at_count: Optional[int] = Field(None, description="下次保养使用次数")
    usages_until_due: Optional[int] = Field(None, description="距下次保养剩余使用次数")
    last_maintenance_date: Optional[date] = Field(None, description="上次保养日期")
    days_since_maintenance: Optional[int] = Field(None, description="距上次保养天数")
    trigger_interval_days: Optional[int] = Field(None, description="方案按天触发间隔")
    reminder_type: str = Field(..., description="提醒类型（due_soon/overdue）")


class MoldCalibrationListResponse(BaseModel):
    """
    模具校验记录列表响应 Schema
    """
    model_config = ConfigDict(from_attributes=True)

    items: list[MoldCalibrationResponse] = Field(..., description="校验记录列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


class MoldMaintenanceReminderListResponse(BaseModel):
    """
    模具保养提醒列表响应 Schema
    """
    items: list[MoldMaintenanceReminderResponse] = Field(..., description="提醒列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")

