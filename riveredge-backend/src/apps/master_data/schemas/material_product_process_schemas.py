"""物料产品工艺 API Schema"""

from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductProcessLineSchema(BaseModel):
    """产品工艺工序行"""

    model_config = ConfigDict(populate_by_name=True)

    operation_uuid: str = Field(..., alias="operationUuid")
    operation_id: Optional[int] = Field(None, alias="operationId")
    code: Optional[str] = None
    name: Optional[str] = None
    standard_time: Optional[float] = Field(None, alias="standardTime", description="标准工时（小时/件，API 存小时）")
    setup_time: Optional[float] = Field(None, alias="setupTime", description="准备时间（小时，API 存小时）")
    workshop_ids: Optional[List[int]] = Field(default=None, alias="workshopIds")
    operator_ids: Optional[List[int]] = Field(default=None, alias="operatorIds")
    team_ids: Optional[List[int]] = Field(default=None, alias="teamIds")
    equipment_ids: Optional[List[int]] = Field(default=None, alias="equipmentIds")
    piece_rate: Optional[Decimal] = Field(None, alias="pieceRate")
    reporting_type: Optional[str] = Field("quantity", alias="reportingType")
    is_node_operation: bool = Field(False, alias="isNodeOperation")
    over_report_mode: Optional[str] = Field("none", alias="overReportMode")
    over_report_value: Optional[float] = Field(0, alias="overReportValue")


class MaterialProductProcessResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    material_uuid: str = Field(..., alias="materialUuid")
    material_id: int = Field(..., alias="materialId")
    process_route_uuid: Optional[str] = Field(None, alias="processRouteUuid")
    process_route_id: Optional[int] = Field(None, alias="processRouteId")
    allow_operation_jump: bool = Field(False, alias="allowOperationJump")
    lines: List[ProductProcessLineSchema] = Field(default_factory=list)


class MaterialProductProcessSave(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    process_route_uuid: Optional[str] = Field(None, alias="processRouteUuid")
    allow_operation_jump: bool = Field(False, alias="allowOperationJump")
    lines: List[ProductProcessLineSchema] = Field(default_factory=list)


class ProcessRouteOperationTemplateResponse(BaseModel):
    """工艺路线工序模板（产品工艺导入用，仅需 route:read）"""

    model_config = ConfigDict(populate_by_name=True)

    allow_operation_jump: bool = Field(False, alias="allowOperationJump")
    lines: List[ProductProcessLineSchema] = Field(default_factory=list)
