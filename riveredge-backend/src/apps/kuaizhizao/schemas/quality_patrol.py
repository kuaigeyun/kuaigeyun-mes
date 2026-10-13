"""质量巡检单 Schema"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from core.schemas.base import BaseSchema
from apps.kuaizhizao.services.document_action_policy.types import QualityInspectionCapabilities


class QualityPatrolBase(BaseSchema):
    source_type: Optional[str] = Field(None, description="可选来源类型")
    source_id: Optional[int] = Field(None, description="可选来源单据ID")
    source_code: Optional[str] = Field(None, description="可选来源单据编码")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    material_spec: Optional[str] = Field(None, description="物料规格")
    material_unit: Optional[str] = Field(None, max_length=20, description="物料单位")
    batch_number: Optional[str] = Field(None, description="批次号")
    workshop_id: Optional[int] = Field(None, description="车间ID")
    workshop_name: Optional[str] = Field(None, description="车间名称")
    production_line_id: Optional[int] = Field(None, description="产线ID")
    production_line_name: Optional[str] = Field(None, description="产线名称")
    workstation_id: Optional[int] = Field(None, description="工位ID")
    workstation_name: Optional[str] = Field(None, description="工位名称")
    operation_id: Optional[int] = Field(None, description="工序ID")
    operation_name: Optional[str] = Field(None, description="工序名称")
    work_order_id: Optional[int] = Field(None, description="工单ID")
    work_order_code: Optional[str] = Field(None, description="工单编码")
    inspection_quantity: float = Field(..., description="检验数量")
    qualified_quantity: float = Field(0, description="合格数量")
    unqualified_quantity: float = Field(0, description="不合格数量")
    inspection_result: str = Field("待检验", description="检验结果")
    quality_status: str = Field("合格", description="质量状态")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    nonconformance_reason: Optional[str] = Field(None, description="不合格原因")
    disposition: Optional[str] = Field(None, description="处理方式")
    corrective_action: Optional[str] = Field(None, description="纠正措施")


class QualityPatrolCreate(QualityPatrolBase):
    inspection_code: Optional[str] = Field(None, description="巡检单号，可空自动生成")
    inspection_plan_id: Optional[int] = Field(None, description="建单时指定质检方案")


class QualityPatrolUpdate(BaseModel):
    notes: Optional[str] = None
    attachments: Optional[List[dict]] = None
    disposition: Optional[str] = None
    nonconformance_reason: Optional[str] = None
    corrective_action: Optional[str] = None
    batch_number: Optional[str] = None
    workshop_id: Optional[int] = None
    workshop_name: Optional[str] = None
    production_line_id: Optional[int] = None
    production_line_name: Optional[str] = None
    workstation_id: Optional[int] = None
    workstation_name: Optional[str] = None
    operation_id: Optional[int] = None
    operation_name: Optional[str] = None
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None


class QualityPatrolConduct(BaseSchema):
    inspection_result: str = Field(..., description="检验结果")
    quality_status: str = Field(..., description="质量状态")
    qualified_quantity: float = Field(0, description="合格数量")
    unqualified_quantity: float = Field(0, description="不合格数量")
    inspector_id: Optional[int] = Field(None, description="检验人员ID")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    nonconformance_reason: Optional[str] = Field(None, description="不合格原因")
    disposition: Optional[str] = Field(None, description="处理方式")
    corrective_action: Optional[str] = Field(None, description="纠正措施")
    measurement_data: Optional[dict] = Field(None, description="测量数据")
    item_results: Optional[dict] = Field(None, description="检验项判定结果")
    conduct_step_results: Optional[dict] = Field(None, description="方案步骤检验结果")


class QualityPatrolResponse(QualityPatrolBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    inspection_code: str
    uuid: str
    tenant_id: int
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    inspection_time: Optional[datetime] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_time: Optional[datetime] = None
    review_status: str = "待审核"
    review_remarks: Optional[str] = None
    status: str
    inspection_standard: Optional[str] = None
    other_checks: Optional[dict] = None
    capabilities: Optional[QualityInspectionCapabilities] = Field(
        None, description="业务态 capabilities（不含 RBAC）"
    )
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
