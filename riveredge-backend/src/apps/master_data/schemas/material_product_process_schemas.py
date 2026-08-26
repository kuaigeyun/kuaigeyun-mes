"""物料产品工艺 API Schema"""

from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

TimeUnit = Literal["h", "m", "s"]


class ProductProcessLineSchema(BaseModel):
    """产品工艺工序行"""

    model_config = ConfigDict(populate_by_name=True)

    operation_uuid: str = Field(..., alias="operationUuid")
    operation_id: Optional[int] = Field(None, alias="operationId")
    code: Optional[str] = None
    name: Optional[str] = None
    standard_time: Optional[float] = Field(
        None,
        alias="standardTime",
        description="标准工时：standardTimeQty 件合计秒数",
    )
    standard_time_qty: Optional[float] = Field(
        1,
        alias="standardTimeQty",
        description="标准工时件数基准，默认 1",
        ge=1,
    )
    standard_time_unit: Optional[TimeUnit] = Field(
        "m",
        alias="standardTimeUnit",
        description="标准工时 UI 单位偏好 h/m/s，不参与运算",
    )
    setup_time: Optional[float] = Field(
        None,
        alias="setupTime",
        description="准备时间（秒，整批固定）",
    )
    setup_time_unit: Optional[TimeUnit] = Field(
        "m",
        alias="setupTimeUnit",
        description="准备时间 UI 单位偏好 h/m/s，不参与运算",
    )
    workshop_ids: Optional[List[int]] = Field(default=None, alias="workshopIds")
    operator_ids: Optional[List[int]] = Field(default=None, alias="operatorIds")
    team_ids: Optional[List[int]] = Field(default=None, alias="teamIds")
    equipment_ids: Optional[List[int]] = Field(default=None, alias="equipmentIds")
    piece_rate: Optional[Decimal] = Field(None, alias="pieceRate")
    reporting_type: Optional[str] = Field("quantity", alias="reportingType")
    is_node_operation: bool = Field(False, alias="isNodeOperation")
    over_report_mode: Optional[str] = Field("none", alias="overReportMode")
    over_report_value: Optional[float] = Field(0, alias="overReportValue")
    is_outsourced: bool = Field(False, alias="isOutsourced", description="计划工序委外")
    outsource_lead_time_days: Optional[int] = Field(
        None, alias="outsourceLeadTimeDays", description="委外提前期（天）", ge=0
    )
    outsource_supplier_id: Optional[int] = Field(
        None, alias="outsourceSupplierId", description="默认委外供应商ID"
    )
    outsource_supplier_name: Optional[str] = Field(
        None, alias="outsourceSupplierName", description="默认委外供应商名称"
    )

    @field_validator("standard_time_qty")
    @classmethod
    def _qty_at_least_one(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return 1.0
        if float(v) < 1:
            raise ValueError("standardTimeQty 须 >= 1")
        return float(v)


class MaterialProductProcessResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    material_uuid: str = Field(..., alias="materialUuid")
    material_id: int = Field(..., alias="materialId")
    process_route_uuid: Optional[str] = Field(None, alias="processRouteUuid")
    process_route_id: Optional[int] = Field(None, alias="processRouteId")
    allow_operation_jump: bool = Field(False, alias="allowOperationJump")
    lines: List[ProductProcessLineSchema] = Field(default_factory=list)
    created_at: Optional[datetime] = Field(None, alias="createdAt")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt")
    created_by: Optional[int] = Field(None, alias="createdBy")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by: Optional[int] = Field(None, alias="updatedBy")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")


class MaterialProductProcessSave(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    process_route_uuid: Optional[str] = Field(None, alias="processRouteUuid")
    allow_operation_jump: bool = Field(False, alias="allowOperationJump")
    lines: List[ProductProcessLineSchema] = Field(default_factory=list)
    save_as_new_route: bool = Field(
        False,
        alias="saveAsNewRoute",
        description="另存为新工艺路线主数据并同步物料默认路线（仅新建，不覆盖已有路线）",
    )
    new_route_code: Optional[str] = Field(None, alias="newRouteCode")
    new_route_name: Optional[str] = Field(None, alias="newRouteName")


class ProcessRouteOperationTemplateResponse(BaseModel):
    """工艺路线工序模板（产品工艺导入用，仅需 route:read）"""

    model_config = ConfigDict(populate_by_name=True)

    allow_operation_jump: bool = Field(False, alias="allowOperationJump")
    lines: List[ProductProcessLineSchema] = Field(default_factory=list)
