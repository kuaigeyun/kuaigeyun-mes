"""
二维码 Schema 定义

提供二维码相关的数据验证和序列化。
"""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field, validator


class QRCodeGenerateRequest(BaseModel):
    """生成二维码请求"""
    qrcode_type: str = Field(..., description="二维码类型（MAT/WO/OP/EQ/EMP/BOX/TRACE）")
    data: Dict[str, Any] = Field(..., description="二维码数据")
    size: int = Field(10, ge=1, le=50, description="二维码大小（每个模块的像素数）")
    border: int = Field(4, ge=1, le=10, description="边框大小")
    error_correction: str = Field("M", description="错误纠正级别（L/M/Q/H）")
    
    @validator("qrcode_type")
    def validate_qrcode_type(cls, v):
        """验证二维码类型"""
        valid_types = ["MAT", "WO", "OP", "EQ", "EMP", "BOX", "TRACE"]
        if v not in valid_types:
            raise ValueError(f"二维码类型必须是以下之一: {', '.join(valid_types)}")
        return v
    
    @validator("error_correction")
    def validate_error_correction(cls, v):
        """验证错误纠正级别"""
        valid_levels = ["L", "M", "Q", "H"]
        if v not in valid_levels:
            raise ValueError(f"错误纠正级别必须是以下之一: {', '.join(valid_levels)}")
        return v


class QRCodeGenerateResponse(BaseModel):
    """生成二维码响应"""
    qrcode_type: str = Field(..., description="二维码类型")
    qrcode_text: str = Field(..., description="二维码文本内容（JSON格式）")
    qrcode_image: str = Field(..., description="二维码图片（base64编码的data URI）")
    size: int = Field(..., description="二维码大小")
    border: int = Field(..., description="边框大小")
    error_correction: str = Field(..., description="错误纠正级别")


class QRCodeParseRequest(BaseModel):
    """解析二维码请求"""
    qrcode_text: Optional[str] = Field(None, description="二维码文本内容")
    qrcode_image: Optional[str] = Field(None, description="二维码图片（base64编码）")
    
    @validator("qrcode_text", "qrcode_image", always=True)
    def validate_at_least_one(cls, v, values):
        """至少提供一个参数"""
        if not v and not values.get("qrcode_text") and not values.get("qrcode_image"):
            raise ValueError("必须提供qrcode_text或qrcode_image之一")
        return v


class QRCodeParseResponse(BaseModel):
    """解析二维码响应"""
    qrcode_type: str = Field(..., description="二维码类型")
    data: Dict[str, Any] = Field(..., description="二维码数据")
    valid: bool = Field(..., description="是否有效")


class MaterialQRCodeGenerateRequest(BaseModel):
    """生成物料二维码请求"""
    material_uuid: str = Field(..., description="物料UUID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    size: int = Field(10, ge=1, le=50, description="二维码大小")
    border: int = Field(4, ge=1, le=10, description="边框大小")
    error_correction: str = Field("M", description="错误纠正级别")


class WorkOrderQRCodeGenerateRequest(BaseModel):
    """生成工单二维码请求"""
    work_order_uuid: str = Field(..., description="工单UUID")
    work_order_code: str = Field(..., description="工单编码")
    material_code: str = Field(..., description="物料编码")
    size: int = Field(10, ge=1, le=50, description="二维码大小")
    border: int = Field(4, ge=1, le=10, description="边框大小")
    error_correction: str = Field("M", description="错误纠正级别")


class OperationQRCodeGenerateRequest(BaseModel):
    """生成工序二维码请求"""
    operation_uuid: str = Field(..., description="工序UUID")
    operation_name: str = Field(..., description="工序名称")
    work_order_code: str = Field(..., description="工单编码")
    size: int = Field(10, ge=1, le=50, description="二维码大小")
    border: int = Field(4, ge=1, le=10, description="边框大小")
    error_correction: str = Field("M", description="错误纠正级别")


class EquipmentQRCodeGenerateRequest(BaseModel):
    """生成设备二维码请求"""
    equipment_uuid: str = Field(..., description="设备UUID")
    equipment_code: str = Field(..., description="设备编码")
    equipment_name: str = Field(..., description="设备名称")
    size: int = Field(10, ge=1, le=50, description="二维码大小")
    border: int = Field(4, ge=1, le=10, description="边框大小")
    error_correction: str = Field("M", description="错误纠正级别")


class EmployeeQRCodeGenerateRequest(BaseModel):
    """生成人员二维码请求"""
    employee_uuid: str = Field(..., description="人员UUID")
    employee_code: str = Field(..., description="人员编码")
    employee_name: str = Field(..., description="人员名称")
    size: int = Field(10, ge=1, le=50, description="二维码大小")
    border: int = Field(4, ge=1, le=10, description="边框大小")
    error_correction: str = Field("M", description="错误纠正级别")


class BoxQRCodeGenerateRequest(BaseModel):
    """生成装箱二维码请求"""
    box_uuid: str = Field(..., description="装箱UUID")
    box_code: str = Field(..., description="装箱编码")
    material_codes: List[str] = Field(..., description="物料编码列表")
    size: int = Field(10, ge=1, le=50, description="二维码大小")
    border: int = Field(4, ge=1, le=10, description="边框大小")
    error_correction: str = Field("M", description="错误纠正级别")


class TraceQRCodeGenerateRequest(BaseModel):
    """生成追溯二维码请求"""
    trace_uuid: str = Field(..., description="追溯UUID")
    trace_code: str = Field(..., description="追溯编码")
    trace_data: Dict[str, Any] = Field(..., description="追溯数据")
    size: int = Field(10, ge=1, le=50, description="二维码大小")
    border: int = Field(4, ge=1, le=10, description="边框大小")
    error_correction: str = Field("M", description="错误纠正级别")
