"""
质量管理模块数据验证schema

提供质量管理相关的数据验证和序列化。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import Field
from core.schemas.base import BaseSchema


# === 来料检验单 ===

class IncomingInspectionBase(BaseSchema):
    """来料检验单基础schema"""
    inspection_code: str = Field(..., max_length=50, description="检验单编码")
    purchase_receipt_id: int = Field(..., description="采购入库单ID")
    purchase_receipt_code: Optional[str] = Field(None, max_length=50, description="采购入库单编码")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    supplier_name: Optional[str] = Field(None, max_length=200, description="供应商名称")
    material_id: Optional[int] = Field(None, description="物料ID（如果使用items则不需要）")
    material_code: Optional[str] = Field(None, max_length=50, description="物料编码（如果使用items则不需要）")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称（如果使用items则不需要）")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: Optional[str] = Field(None, max_length=20, description="物料单位")
    inspection_quantity: Optional[float] = Field(None, gt=0, description="检验数量（如果使用items则不需要）")
    qualified_quantity: Optional[float] = Field(None, ge=0, description="合格数量（如果使用items则不需要）")
    unqualified_quantity: Optional[float] = Field(None, ge=0, description="不合格数量（如果使用items则不需要）")
    inspection_result: str = Field("待检验", max_length=20, description="检验结果")
    quality_status: str = Field("合格", max_length=20, description="质量状态")
    inspector_id: Optional[int] = Field(None, description="检验人ID")
    inspector_name: Optional[str] = Field(None, max_length=100, description="检验人姓名")
    inspection_time: Optional[datetime] = Field(None, description="检验时间")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    inspection_standard: Optional[str] = Field(None, description="检验标准")
    inspection_method: Optional[str] = Field(None, max_length=100, description="检验方法")
    test_equipment: Optional[str] = Field(None, max_length=200, description="测试设备")
    appearance_check: Optional[str] = Field(None, max_length=20, description="外观检查")
    dimension_check: Optional[str] = Field(None, max_length=20, description="尺寸检查")
    performance_check: Optional[str] = Field(None, max_length=20, description="性能检查")
    other_checks: Optional[dict] = Field(None, description="其他检查项目（JSON格式）")
    nonconformance_reason: Optional[str] = Field(None, description="不合格原因")
    disposition: Optional[str] = Field(None, max_length=50, description="处理方式")
    corrective_action: Optional[str] = Field(None, description="纠正措施")
    status: str = Field("待检验", max_length=20, description="单据状态")
    notes: Optional[str] = Field(None, description="备注")


class IncomingInspectionItemCreate(BaseSchema):
    """来料检验单明细创建schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    inspection_quantity: float = Field(..., gt=0, description="检验数量")
    qualified_quantity: float = Field(0, ge=0, description="合格数量")
    unqualified_quantity: float = Field(0, ge=0, description="不合格数量")


class IncomingInspectionCreate(IncomingInspectionBase):
    """来料检验单创建schema"""
    inspection_code: Optional[str] = Field(None, max_length=50, description="检验单编码（可选，如果不提供则自动生成）")
    items: Optional[List[IncomingInspectionItemCreate]] = Field(None, description="检验明细列表（如果提供items，则忽略基础schema中的物料字段）")


class IncomingInspectionUpdate(IncomingInspectionBase):
    """来料检验单更新schema"""
    inspection_code: Optional[str] = Field(None, max_length=50, description="检验单编码")


class IncomingInspectionResponse(IncomingInspectionBase):
    """来料检验单响应schema"""
    id: int = Field(..., description="检验单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")

    class Config:
        from_attributes = True


class IncomingInspectionListResponse(IncomingInspectionResponse):
    """来料检验单列表响应schema（简化版）"""
    pass


# === 过程检验单 ===

class ProcessInspectionBase(BaseSchema):
    """过程检验单基础schema"""
    inspection_code: str = Field(..., max_length=50, description="检验单编码")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., max_length=50, description="工单编码")
    operation_id: int = Field(..., description="工序ID")
    operation_code: str = Field(..., max_length=50, description="工序编码")
    operation_name: str = Field(..., max_length=200, description="工序名称")
    workshop_id: Optional[int] = Field(None, description="车间ID")
    workshop_name: Optional[str] = Field(None, max_length=100, description="车间名称")
    workstation_id: Optional[int] = Field(None, description="工位ID")
    workstation_name: Optional[str] = Field(None, max_length=100, description="工位名称")
    material_id: int = Field(..., description="生产物料ID")
    material_code: str = Field(..., max_length=50, description="生产物料编码")
    material_name: str = Field(..., max_length=200, description="生产物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    batch_number: Optional[str] = Field(None, max_length=50, description="生产批次号")
    inspection_quantity: float = Field(..., gt=0, description="检验数量")
    qualified_quantity: float = Field(0, ge=0, description="合格数量")
    unqualified_quantity: float = Field(0, ge=0, description="不合格数量")
    inspection_result: str = Field("待检验", max_length=20, description="检验结果")
    quality_status: str = Field("合格", max_length=20, description="质量状态")
    inspector_id: Optional[int] = Field(None, description="检验人ID")
    inspector_name: Optional[str] = Field(None, max_length=100, description="检验人姓名")
    inspection_time: Optional[datetime] = Field(None, description="检验时间")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    inspection_standard: Optional[str] = Field(None, description="检验标准")
    inspection_method: Optional[str] = Field(None, max_length=100, description="检验方法")
    test_equipment: Optional[str] = Field(None, max_length=200, description="测试设备")
    process_parameters: Optional[dict] = Field(None, description="过程参数检查（JSON格式）")
    quality_characteristics: Optional[dict] = Field(None, description="质量特性检查（JSON格式）")
    measurement_data: Optional[dict] = Field(None, description="测量数据（JSON格式）")
    nonconformance_reason: Optional[str] = Field(None, description="不合格原因")
    disposition: Optional[str] = Field(None, max_length=50, description="处理方式")
    corrective_action: Optional[str] = Field(None, description="纠正措施")
    preventive_action: Optional[str] = Field(None, description="预防措施")
    status: str = Field("待检验", max_length=20, description="单据状态")
    notes: Optional[str] = Field(None, description="备注")


class ProcessInspectionCreate(ProcessInspectionBase):
    """过程检验单创建schema"""
    pass


class ProcessInspectionUpdate(ProcessInspectionBase):
    """过程检验单更新schema"""
    inspection_code: Optional[str] = Field(None, max_length=50, description="检验单编码")


class ProcessInspectionResponse(ProcessInspectionBase):
    """过程检验单响应schema"""
    id: int = Field(..., description="检验单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")

    class Config:
        from_attributes = True


class ProcessInspectionListResponse(ProcessInspectionResponse):
    """过程检验单列表响应schema（简化版）"""
    pass


# === 成品检验单 ===

class FinishedGoodsInspectionBase(BaseSchema):
    """成品检验单基础schema"""
    inspection_code: str = Field(..., max_length=50, description="检验单编码")
    source_type: str = Field(..., max_length=20, description="来源单据类型")
    source_id: int = Field(..., description="来源单据ID")
    source_code: str = Field(..., max_length=50, description="来源单据编码")
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., max_length=50, description="工单编码")
    sales_order_id: Optional[int] = Field(None, description="销售订单ID")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="销售订单编码")
    customer_id: Optional[int] = Field(None, description="客户ID")
    customer_name: Optional[str] = Field(None, max_length=200, description="客户名称")
    material_id: int = Field(..., description="成品物料ID")
    material_code: str = Field(..., max_length=50, description="成品物料编码")
    material_name: str = Field(..., max_length=200, description="成品物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="成品规格")
    batch_number: Optional[str] = Field(None, max_length=50, description="生产批次号")
    inspection_quantity: float = Field(..., gt=0, description="检验数量")
    qualified_quantity: float = Field(0, ge=0, description="合格数量")
    unqualified_quantity: float = Field(0, ge=0, description="不合格数量")
    inspection_result: str = Field("待检验", max_length=20, description="检验结果")
    quality_status: str = Field("合格", max_length=20, description="质量状态")
    inspector_id: Optional[int] = Field(None, description="检验人ID")
    inspector_name: Optional[str] = Field(None, max_length=100, description="检验人姓名")
    inspection_time: Optional[datetime] = Field(None, description="检验时间")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    inspection_standard: Optional[str] = Field(None, description="检验标准")
    inspection_method: Optional[str] = Field(None, max_length=100, description="检验方法")
    test_equipment: Optional[str] = Field(None, max_length=200, description="测试设备")
    appearance_check: Optional[str] = Field(None, max_length=20, description="外观检查")
    dimension_check: Optional[str] = Field(None, max_length=20, description="尺寸检查")
    performance_check: Optional[str] = Field(None, max_length=20, description="性能检查")
    function_test: Optional[str] = Field(None, max_length=20, description="功能测试")
    packaging_check: Optional[str] = Field(None, max_length=20, description="包装检查")
    documentation_check: Optional[str] = Field(None, max_length=20, description="文件检查")
    other_checks: Optional[dict] = Field(None, description="其他检查项目（JSON格式）")
    measurement_data: Optional[dict] = Field(None, description="测量数据（JSON格式）")
    nonconformance_reason: Optional[str] = Field(None, description="不合格原因")
    disposition: Optional[str] = Field(None, max_length=50, description="处理方式")
    corrective_action: Optional[str] = Field(None, description="纠正措施")
    preventive_action: Optional[str] = Field(None, description="预防措施")
    release_certificate: Optional[str] = Field(None, max_length=100, description="放行证书号")
    certificate_issued: bool = Field(False, description="是否已出具证书")
    status: str = Field("待检验", max_length=20, description="单据状态")
    notes: Optional[str] = Field(None, description="备注")


class FinishedGoodsInspectionCreate(FinishedGoodsInspectionBase):
    """成品检验单创建schema"""
    pass


class FinishedGoodsInspectionUpdate(FinishedGoodsInspectionBase):
    """成品检验单更新schema"""
    inspection_code: Optional[str] = Field(None, max_length=50, description="检验单编码")


class FinishedGoodsInspectionResponse(FinishedGoodsInspectionBase):
    """成品检验单响应schema"""
    id: int = Field(..., description="检验单ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")

    class Config:
        from_attributes = True


class FinishedGoodsInspectionListResponse(FinishedGoodsInspectionResponse):
    """成品检验单列表响应schema（简化版）"""
    pass


# === 质检标准 ===

class QualityStandardBase(BaseSchema):
    """质检标准基础schema"""
    standard_code: str = Field(..., max_length=50, description="标准编码")
    standard_name: str = Field(..., max_length=200, description="标准名称")
    standard_type: str = Field(..., max_length=50, description="标准类型（incoming/process/finished）")
    material_id: Optional[int] = Field(None, description="关联物料ID（为空则适用于所有物料）")
    material_code: Optional[str] = Field(None, max_length=50, description="关联物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="关联物料名称")
    inspection_items: Optional[Dict[str, Any]] = Field(None, description="检验项目列表（JSON格式）")
    inspection_methods: Optional[Dict[str, Any]] = Field(None, description="检验方法列表（JSON格式）")
    acceptance_criteria: Optional[Dict[str, Any]] = Field(None, description="合格标准（JSON格式）")
    version: str = Field("1.0", max_length=20, description="版本号")
    effective_date: Optional[date] = Field(None, description="生效日期")
    expiry_date: Optional[date] = Field(None, description="失效日期")
    is_active: bool = Field(True, description="是否启用")
    remarks: Optional[str] = Field(None, description="备注")


class QualityStandardCreate(QualityStandardBase):
    """质检标准创建schema"""
    standard_code: Optional[str] = Field(None, max_length=50, description="标准编码（可选，如果不提供则自动生成）")


class QualityStandardUpdate(QualityStandardBase):
    """质检标准更新schema"""
    standard_code: Optional[str] = Field(None, max_length=50, description="标准编码")
    standard_name: Optional[str] = Field(None, max_length=200, description="标准名称")
    standard_type: Optional[str] = Field(None, max_length=50, description="标准类型")


class QualityStandardResponse(QualityStandardBase):
    """质检标准响应schema"""
    id: int = Field(..., description="标准ID")
    uuid: Optional[str] = Field(None, description="业务ID")
    tenant_id: Optional[int] = Field(None, description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class QualityStandardListResponse(QualityStandardResponse):
    """质检标准列表响应schema（简化版）"""
    pass
