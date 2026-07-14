"""
设备 Schema 模块

定义设备相关的 Pydantic Schema，用于 API 请求和响应验证。

Author: Luigi Lu
Date: 2026-01-05
"""

from datetime import datetime, date
from typing import Optional, Dict, Any, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict, field_validator


class EquipmentBase(BaseModel):
    """
    设备基础 Schema
    
    包含设备的基本字段，用于创建和更新操作。
    """
    code: Optional[str] = Field(None, max_length=50, description="设备编码（可选，创建时自动生成）")
    name: str = Field(..., min_length=1, max_length=200, description="设备名称")
    type: Optional[str] = Field(None, max_length=50, description="设备类型（如：加工设备、检测设备、包装设备等）")
    category: Optional[str] = Field(None, max_length=50, description="设备分类（如：CNC、注塑机、冲压机等）")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    serial_number: Optional[str] = Field(None, max_length=100, description="序列号")
    manufacturer: Optional[str] = Field(None, max_length=200, description="制造商")
    supplier: Optional[str] = Field(None, max_length=200, description="供应商")
    purchase_date: Optional[date] = Field(None, description="采购日期")
    installation_date: Optional[date] = Field(None, description="安装日期")
    warranty_period: Optional[int] = Field(None, ge=0, description="保修期（月）")
    technical_parameters: Optional[Dict[str, Any]] = Field(None, description="技术参数（JSON格式）")
    workshop_id: Optional[int] = Field(None, description="关联车间ID（可选）")
    workshop_name: Optional[str] = Field(None, max_length=200, description="关联车间名称")
    production_line_id: Optional[int] = Field(None, description="使用产线ID（线组，可选）")
    production_line_code: Optional[str] = Field(None, max_length=50, description="使用产线编码")
    production_line_name: Optional[str] = Field(None, max_length=200, description="使用产线名称")
    equipment_nature: Optional[str] = Field(None, max_length=50, description="设备性质")
    workstation_id: Optional[int] = Field(None, description="关联工位ID（可选）")
    workstation_code: Optional[str] = Field(None, max_length=50, description="工位编码")
    workstation_name: Optional[str] = Field(None, max_length=200, description="工位名称")
    work_center_id: Optional[int] = Field(None, description="关联工作中心ID（可选）")
    work_center_code: Optional[str] = Field(None, max_length=50, description="工作中心编码")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    status: str = Field(default="正常", max_length=50, description="设备状态（正常、维修中、停用、报废）")
    is_active: bool = Field(default=True, description="是否启用")
    description: Optional[str] = Field(None, description="描述")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """
        验证设备状态
        
        Args:
            v: 设备状态值
            
        Returns:
            验证后的设备状态值
            
        Raises:
            ValueError: 如果设备状态不合法
        """
        allowed_statuses = ["正常", "维修中", "停用", "校验中", "报废"]
        if v not in allowed_statuses:
            raise ValueError(f"设备状态必须是 {allowed_statuses} 之一")
        return v


class EquipmentCreate(EquipmentBase):
    """
    设备创建 Schema
    
    用于创建新设备的请求数据。
    """
    pass


class EquipmentUpdate(BaseModel):
    """
    设备更新 Schema
    
    用于更新设备的请求数据，所有字段可选。
    """
    code: Optional[str] = Field(None, max_length=50, description="设备编码")
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="设备名称")
    type: Optional[str] = Field(None, max_length=50, description="设备类型")
    category: Optional[str] = Field(None, max_length=50, description="设备分类")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    serial_number: Optional[str] = Field(None, max_length=100, description="序列号")
    manufacturer: Optional[str] = Field(None, max_length=200, description="制造商")
    supplier: Optional[str] = Field(None, max_length=200, description="供应商")
    purchase_date: Optional[date] = Field(None, description="采购日期")
    installation_date: Optional[date] = Field(None, description="安装日期")
    warranty_period: Optional[int] = Field(None, ge=0, description="保修期（月）")
    technical_parameters: Optional[Dict[str, Any]] = Field(None, description="技术参数（JSON格式）")
    workshop_id: Optional[int] = Field(None, description="关联车间ID（可选）")
    workshop_name: Optional[str] = Field(None, max_length=200, description="关联车间名称")
    production_line_id: Optional[int] = Field(None, description="使用产线ID（线组，可选）")
    production_line_code: Optional[str] = Field(None, max_length=50, description="使用产线编码")
    production_line_name: Optional[str] = Field(None, max_length=200, description="使用产线名称")
    equipment_nature: Optional[str] = Field(None, max_length=50, description="设备性质")
    workstation_id: Optional[int] = Field(None, description="关联工位ID（可选）")
    workstation_code: Optional[str] = Field(None, max_length=50, description="工位编码")
    workstation_name: Optional[str] = Field(None, max_length=200, description="工位名称")
    work_center_id: Optional[int] = Field(None, description="关联工作中心ID（可选）")
    work_center_code: Optional[str] = Field(None, max_length=50, description="工作中心编码")
    work_center_name: Optional[str] = Field(None, max_length=200, description="工作中心名称")
    status: Optional[str] = Field(None, max_length=50, description="设备状态（正常、维修中、停用、报废）")
    is_active: Optional[bool] = Field(None, description="是否启用")
    description: Optional[str] = Field(None, description="描述")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """
        验证设备状态
        
        Args:
            v: 设备状态值（可选）
            
        Returns:
            验证后的设备状态值
            
        Raises:
            ValueError: 如果设备状态不合法
        """
        if v is not None:
            allowed_statuses = ["正常", "维修中", "停用", "校验中", "报废"]
            if v not in allowed_statuses:
                raise ValueError(f"设备状态必须是 {allowed_statuses} 之一")
        return v


class EquipmentResponse(EquipmentBase):
    """
    设备响应 Schema
    
    用于返回设备信息的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    uuid: str = Field(..., description="设备UUID（对外暴露，业务标识）")
    id: int = Field(..., description="设备ID（内部使用）")
    tenant_id: int = Field(..., description="组织ID")
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间（软删除）")


class EquipmentListResponse(BaseModel):
    """
    设备列表响应 Schema
    
    用于返回设备列表的响应数据。
    """
    model_config = ConfigDict(from_attributes=True)
    
    items: list[EquipmentResponse] = Field(..., description="设备列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


class EquipmentCalibrationCreate(BaseModel):
    """设备校验记录创建 Schema"""
    calibration_date: date = Field(..., description="校验日期")
    result: str = Field(..., max_length=50, description="校验结果（合格、不合格、限制使用）")
    certificate_no: Optional[str] = Field(None, max_length=100, description="证书编号")
    expiry_date: Optional[date] = Field(None, description="有效期至")
    attachment_uuid: Optional[str] = Field(None, max_length=36, description="报告附件ID")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    remark: Optional[str] = Field(None, description="备注")


class EquipmentCalibrationCreateWithEquipment(BaseModel):
    """设备校验记录创建 Schema（含设备 UUID，用于独立检定页）"""
    equipment_uuid: str = Field(..., description="设备UUID")
    calibration_date: date = Field(..., description="校验日期")
    result: str = Field(..., max_length=50, description="校验结果（合格、不合格、限制使用）")
    certificate_no: Optional[str] = Field(None, max_length=100, description="证书编号")
    expiry_date: Optional[date] = Field(None, description="有效期至")
    attachment_uuid: Optional[str] = Field(None, max_length=36, description="报告附件ID")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    remark: Optional[str] = Field(None, description="备注")


class EquipmentCalibrationResponse(BaseModel):
    """设备校验记录响应 Schema"""
    model_config = ConfigDict(from_attributes=True)
    uuid: str
    id: int
    equipment_id: int
    equipment_uuid: str
    equipment_code: Optional[str] = Field(None, description="设备编码")
    equipment_name: Optional[str] = Field(None, description="设备名称")
    calibration_date: date
    result: str
    certificate_no: Optional[str] = None
    expiry_date: Optional[date] = None
    attachment_uuid: Optional[str] = None
    attachments: Optional[List[dict]] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None


class EquipmentCalibrationListResponse(BaseModel):
    """设备校验记录列表响应 Schema"""
    model_config = ConfigDict(from_attributes=True)
    items: list[EquipmentCalibrationResponse] = Field(..., description="校验记录列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


class EquipmentCalibrationReminderResponse(BaseModel):
    """设备检定到期提醒响应 Schema"""
    equipment_uuid: str = Field(..., description="设备UUID")
    equipment_code: str = Field(..., description="设备编码")
    equipment_name: str = Field(..., description="设备名称")
    reminder_type: str = Field(..., description="提醒类型 calibration")
    due_type: str = Field(..., description="due_soon/overdue")
    due_date: date = Field(..., description="到期日期")
    days_until_due: int = Field(..., description="距到期天数")
    calibration_period: Optional[int] = Field(None, description="校验周期（天）")
    last_calibration_date: Optional[date] = Field(None, description="上次校验日期")


class EquipmentCalibrationReminderListResponse(BaseModel):
    """设备检定到期提醒列表响应 Schema"""
    items: list[EquipmentCalibrationReminderResponse] = Field(..., description="提醒列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")

