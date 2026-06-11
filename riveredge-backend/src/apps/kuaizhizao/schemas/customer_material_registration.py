"""
客户来料登记 / 代工来料数据验证 Schema
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator
from decimal import Decimal


def _coerce_uuid_str(value: Any) -> str:
    if value is None:
        return value
    return str(value)


class BarcodeMappingRuleBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(..., description="映射规则名称")
    customer_id: Optional[int] = Field(None, description="客户ID（可选）")
    customer_name: Optional[str] = Field(None, description="客户名称（可选）")
    barcode_pattern: str = Field(..., description="条码模式（正则表达式）")
    barcode_type: str = Field("1d", description="条码类型（1d/2d）")
    material_id: int = Field(..., description="映射到的物料ID")
    material_code: str = Field(..., description="映射到的物料编码")
    material_name: str = Field(..., description="映射到的物料名称")
    parsing_rule: Optional[Dict[str, Any]] = Field(None, description="解析规则（JSON格式）")
    is_enabled: bool = Field(True, description="是否启用")
    priority: int = Field(0, description="优先级")
    remarks: Optional[str] = Field(None, description="备注")


class BarcodeMappingRuleCreate(BarcodeMappingRuleBase):
    pass


class BarcodeMappingRuleUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, description="映射规则名称")
    barcode_pattern: Optional[str] = Field(None, description="条码模式")
    material_id: Optional[int] = Field(None, description="映射到的物料ID")
    parsing_rule: Optional[Dict[str, Any]] = Field(None, description="解析规则")
    is_enabled: Optional[bool] = Field(None, description="是否启用")
    priority: Optional[int] = Field(None, description="优先级")
    remarks: Optional[str] = Field(None, description="备注")


class BarcodeMappingRuleResponse(BarcodeMappingRuleBase):
    id: int = Field(..., description="映射规则ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="映射规则编码")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")

    @field_validator("uuid", mode="before")
    @classmethod
    def _uuid_to_str(cls, value: Any) -> str:
        return _coerce_uuid_str(value)


class BarcodeMappingRuleListResponse(BarcodeMappingRuleResponse):
    pass


class CustomerMaterialRegistrationItemBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    material_spec: Optional[str] = Field(None, description="物料规格")
    material_unit: Optional[str] = Field(None, description="物料单位")
    quantity: Decimal = Field(..., gt=0, description="来料数量")
    barcode: Optional[str] = Field(None, description="客户条码")
    barcode_type: str = Field("1d", description="条码类型")
    mapping_rule_id: Optional[int] = Field(None, description="映射规则ID")
    batch_number: Optional[str] = Field(None, description="批号")
    remarks: Optional[str] = Field(None, description="备注")


class CustomerMaterialRegistrationItemCreate(CustomerMaterialRegistrationItemBase):
    pass


class CustomerMaterialRegistrationItemResponse(CustomerMaterialRegistrationItemBase):
    id: int = Field(..., description="明细ID")
    uuid: str = Field(..., description="业务ID")
    registration_id: int = Field(..., description="代工来料单ID")
    status: str = Field(..., description="状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    @field_validator("uuid", mode="before")
    @classmethod
    def _uuid_to_str(cls, value: Any) -> str:
        return _coerce_uuid_str(value)


class CustomerMaterialRegistrationBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    barcode: Optional[str] = Field(None, description="客户条码（扫码快速登记）")
    barcode_type: str = Field("1d", description="条码类型（1d/2d）")
    quantity: Optional[Decimal] = Field(None, gt=0, description="来料数量（单行兼容）")
    registration_date: datetime = Field(default_factory=datetime.now, description="登记日期")
    warehouse_id: Optional[int] = Field(None, description="入库仓库ID")
    warehouse_name: Optional[str] = Field(None, description="入库仓库名称")
    sales_order_id: Optional[int] = Field(None, description="销售订单ID")
    sales_order_code: Optional[str] = Field(None, description="销售订单编码")
    work_order_id: Optional[int] = Field(None, description="工单ID")
    work_order_code: Optional[str] = Field(None, description="工单编码")
    batch_number: Optional[str] = Field(None, description="批号")
    material_id: Optional[int] = Field(None, description="物料ID（扫码未映射时手动选择）")
    material_code: Optional[str] = Field(None, description="物料编码")
    material_name: Optional[str] = Field(None, description="物料名称")
    remarks: Optional[str] = Field(None, description="备注")


class CustomerMaterialRegistrationCreate(CustomerMaterialRegistrationBase):
    items: Optional[List[CustomerMaterialRegistrationItemCreate]] = Field(
        None, description="明细行（正式多行单据）"
    )


class CustomerMaterialRegistrationUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    warehouse_id: Optional[int] = Field(None, description="入库仓库ID")
    warehouse_name: Optional[str] = Field(None, description="入库仓库名称")
    sales_order_id: Optional[int] = Field(None, description="销售订单ID")
    sales_order_code: Optional[str] = Field(None, description="销售订单编码")
    work_order_id: Optional[int] = Field(None, description="工单ID")
    work_order_code: Optional[str] = Field(None, description="工单编码")
    remarks: Optional[str] = Field(None, description="备注")
    items: Optional[List[CustomerMaterialRegistrationItemCreate]] = Field(None, description="明细行")


class CustomerMaterialRegistrationResponse(CustomerMaterialRegistrationBase):
    id: int = Field(..., description="登记记录ID")
    uuid: str = Field(..., description="业务ID")
    registration_code: str = Field(..., description="登记编码")
    parsed_data: Optional[Dict[str, Any]] = Field(None, description="解析后的数据")
    mapped_material_id: Optional[int] = Field(None, description="映射到的物料ID")
    mapped_material_code: Optional[str] = Field(None, description="映射到的物料编码")
    mapped_material_name: Optional[str] = Field(None, description="映射到的物料名称")
    mapping_rule_id: Optional[int] = Field(None, description="使用的映射规则ID")
    registered_by: int = Field(..., description="登记人ID")
    registered_by_name: str = Field(..., description="登记人姓名")
    status: str = Field(..., description="状态")
    processed_at: Optional[datetime] = Field(None, description="处理时间")
    processed_by: Optional[int] = Field(None, description="确认入库人ID")
    processed_by_name: Optional[str] = Field(None, description="确认入库人姓名")
    total_quantity: Optional[Decimal] = Field(None, description="来料总数量")
    items: Optional[List[CustomerMaterialRegistrationItemResponse]] = Field(None, description="明细行")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    @field_validator("uuid", mode="before")
    @classmethod
    def _uuid_to_str(cls, value: Any) -> str:
        return _coerce_uuid_str(value)


class CustomerMaterialRegistrationListResponse(CustomerMaterialRegistrationResponse):
    pass


class CustomerMaterialStartProductionResponse(BaseModel):
    """客供料入库并直接发料开工"""

    registration: CustomerMaterialRegistrationResponse = Field(..., description="代工来料单")
    work_order_ids: List[int] = Field(default_factory=list, description="创建的生产工单ID")
    work_order_codes: List[str] = Field(default_factory=list, description="创建的生产工单编码")
    work_order_group_id: Optional[int] = Field(None, description="平级组工单ID（多明细时）")
    work_order_group_code: Optional[str] = Field(None, description="平级组工单编码")
    batching_order_ids: List[int] = Field(default_factory=list, description="配料单ID")
    batching_order_codes: List[str] = Field(default_factory=list, description="配料单编码")
    warnings: List[str] = Field(default_factory=list, description="非阻断提示")


class ParseBarcodeRequest(BaseModel):
    barcode: str = Field(..., description="客户条码（一维码或二维码）")
    barcode_type: Optional[str] = Field("1d", description="条码类型（1d/2d）")
    customer_id: Optional[int] = Field(None, description="客户ID（可选，用于匹配映射规则）")


class ParseBarcodeResponse(BaseModel):
    barcode: str = Field(..., description="原始条码")
    barcode_type: str = Field(..., description="条码类型")
    parsed_data: Dict[str, Any] = Field(..., description="解析后的数据")
    mapped_material_id: Optional[int] = Field(None, description="映射到的物料ID")
    mapped_material_code: Optional[str] = Field(None, description="映射到的物料编码")
    mapped_material_name: Optional[str] = Field(None, description="映射到的物料名称")
    mapping_rule_id: Optional[int] = Field(None, description="使用的映射规则ID")
    mapping_rule_name: Optional[str] = Field(None, description="使用的映射规则名称")
