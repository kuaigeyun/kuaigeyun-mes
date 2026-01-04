"""
客户来料登记数据验证Schema模块

定义客户来料登记相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-04
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class BarcodeMappingRuleBase(BaseModel):
    """
    条码映射规则基础Schema

    包含所有条码映射规则的基本字段。
    """
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
    """
    条码映射规则创建Schema

    用于创建新条码映射规则的数据验证。
    """
    pass


class BarcodeMappingRuleUpdate(BaseModel):
    """
    条码映射规则更新Schema

    用于更新条码映射规则的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, description="映射规则名称")
    barcode_pattern: Optional[str] = Field(None, description="条码模式")
    material_id: Optional[int] = Field(None, description="映射到的物料ID")
    parsing_rule: Optional[Dict[str, Any]] = Field(None, description="解析规则")
    is_enabled: Optional[bool] = Field(None, description="是否启用")
    priority: Optional[int] = Field(None, description="优先级")
    remarks: Optional[str] = Field(None, description="备注")


class BarcodeMappingRuleResponse(BarcodeMappingRuleBase):
    """
    条码映射规则响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="映射规则ID")
    uuid: str = Field(..., description="业务ID")
    code: str = Field(..., description="映射规则编码")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")


class BarcodeMappingRuleListResponse(BarcodeMappingRuleResponse):
    """
    条码映射规则列表响应Schema

    用于条码映射规则列表API的响应数据格式。
    """
    pass


class CustomerMaterialRegistrationBase(BaseModel):
    """
    客户来料登记基础Schema

    包含所有客户来料登记的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    barcode: str = Field(..., description="客户条码（一维码或二维码）")
    barcode_type: str = Field("1d", description="条码类型（1d/2d）")
    quantity: Decimal = Field(..., gt=0, description="来料数量")
    registration_date: datetime = Field(default_factory=datetime.now, description="登记日期")
    warehouse_id: Optional[int] = Field(None, description="入库仓库ID（可选）")
    warehouse_name: Optional[str] = Field(None, description="入库仓库名称（可选）")
    remarks: Optional[str] = Field(None, description="备注")


class CustomerMaterialRegistrationCreate(CustomerMaterialRegistrationBase):
    """
    客户来料登记创建Schema

    用于创建新客户来料登记的数据验证。
    """
    pass


class CustomerMaterialRegistrationResponse(CustomerMaterialRegistrationBase):
    """
    客户来料登记响应Schema

    用于API响应的数据格式。
    """
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
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class CustomerMaterialRegistrationListResponse(CustomerMaterialRegistrationResponse):
    """
    客户来料登记列表响应Schema

    用于客户来料登记列表API的响应数据格式。
    """
    pass


class ParseBarcodeRequest(BaseModel):
    """
    解析条码请求Schema

    用于解析客户来料条码的请求数据。
    """
    barcode: str = Field(..., description="客户条码（一维码或二维码）")
    barcode_type: Optional[str] = Field("1d", description="条码类型（1d/2d）")
    customer_id: Optional[int] = Field(None, description="客户ID（可选，用于匹配映射规则）")


class ParseBarcodeResponse(BaseModel):
    """
    解析条码响应Schema

    用于返回条码解析结果。
    """
    barcode: str = Field(..., description="原始条码")
    barcode_type: str = Field(..., description="条码类型")
    parsed_data: Dict[str, Any] = Field(..., description="解析后的数据")
    mapped_material_id: Optional[int] = Field(None, description="映射到的物料ID")
    mapped_material_code: Optional[str] = Field(None, description="映射到的物料编码")
    mapped_material_name: Optional[str] = Field(None, description="映射到的物料名称")
    mapping_rule_id: Optional[int] = Field(None, description="使用的映射规则ID")
    mapping_rule_name: Optional[str] = Field(None, description="使用的映射规则名称")

