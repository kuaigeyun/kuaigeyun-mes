"""工位终端 API Schema"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class StationAndonCreate(BaseModel):
    call_type: str = Field(..., description="quality/material/equipment/supervisor")
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    operation_id: Optional[int] = None
    workstation_id: Optional[int] = None
    workstation_name: Optional[str] = None
    remarks: Optional[str] = None
    # 联动参数
    equipment_uuid: Optional[str] = Field(None, description="设备安灯：设备UUID")
    fault_level: Optional[str] = Field(None, description="设备安灯：故障级别 轻微/一般/严重/紧急")
    material_call_mode: Optional[str] = Field(
        None, description="物料安灯：FULL_ORDER（齐套缺料）"
    )
    supervisor_user_id: Optional[int] = Field(None, description="班长安灯：通知用户ID")


class StationAndonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: Optional[str] = None
    call_type: str
    status: str
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    operation_id: Optional[int] = None
    workstation_id: Optional[int] = None
    workstation_name: Optional[str] = None
    caller_id: int
    caller_name: str
    remarks: Optional[str] = None
    related_doc_type: Optional[str] = None
    related_doc_uuid: Optional[str] = None
    related_doc_code: Optional[str] = None
    equipment_uuid: Optional[str] = None
    fault_level: Optional[str] = None
    material_call_mode: Optional[str] = None
    supervisor_user_id: Optional[int] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[int] = None
    acknowledged_by_name: Optional[str] = None
    closed_at: Optional[datetime] = None


class StationSopAckCreate(BaseModel):
    sop_uuid: str
    work_order_id: int
    operation_id: int
    worker_id: Optional[int] = None
    worker_name: Optional[str] = None


class StationSopAckCheckResponse(BaseModel):
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None


class OperationPauseRequest(BaseModel):
    reason_code: str = Field(..., description="停机原因码")
    remarks: Optional[str] = None


class OperationCompleteRequest(BaseModel):
    remarks: Optional[str] = None


class FaceEnrollRequest(BaseModel):
    user_id: int
    descriptor: List[float]
    quality: Optional[float] = None
    device_info: Optional[str] = None


class FaceIdentifyRequest(BaseModel):
    descriptor: List[float]


class FaceIdentifyResponse(BaseModel):
    matched: bool
    score: float
    user_id: int
    username: str
    full_name: str
    template_id: int


class FaceTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    quality: Optional[float] = None
    device_info: Optional[str] = None
    created_at: datetime


class SkillCheckRequest(BaseModel):
    user_id: int
    operation_id: int = Field(..., description="主数据工序ID或工单工序行ID（服务端兼容）")
    work_order_id: Optional[int] = None


class SkillCheckResponse(BaseModel):
    qualified: bool
    user_id: int
    operation_id: int
    operation_name: Optional[str] = None
    message: str


class OperatorSkillCreate(BaseModel):
    user_id: int
    user_name: Optional[str] = None
    operation_id: int
    operation_code: Optional[str] = None
    operation_name: Optional[str] = None
    skill_level: str = "qualified"
    remarks: Optional[str] = None


class OperatorSkillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    user_id: int
    user_name: Optional[str] = None
    operation_id: int
    operation_code: Optional[str] = None
    operation_name: Optional[str] = None
    skill_level: str
    is_active: bool
    created_at: datetime


class ShiftSummaryQuery(BaseModel):
    workstation_id: Optional[int] = None
    shift_start: datetime
    shift_end: Optional[datetime] = None


class ShiftSummaryResponse(BaseModel):
    workstation_id: Optional[int] = None
    shift_start: datetime
    shift_end: datetime
    planned_qty: Decimal = Decimal("0")
    completed_qty: Decimal = Decimal("0")
    unqualified_qty: Decimal = Decimal("0")
    downtime_minutes: Decimal = Decimal("0")
    andon_count: int = 0
    reporting_count: int = 0


class ShiftHandoverCreate(BaseModel):
    workstation_id: Optional[int] = None
    workstation_name: Optional[str] = None
    shift_start: datetime
    shift_end: Optional[datetime] = None
    remarks: Optional[str] = None


class ShiftHandoverResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    workstation_id: Optional[int] = None
    workstation_name: Optional[str] = None
    operator_id: int
    operator_name: str
    shift_start: datetime
    shift_end: datetime
    planned_qty: Decimal
    completed_qty: Decimal
    unqualified_qty: Decimal
    downtime_minutes: Decimal
    andon_count: int
    remarks: Optional[str] = None
    created_at: datetime


class StationDocFileItem(BaseModel):
    """工位文档条目（图纸 / 附件），预览走 core files。"""

    key: str
    name: str
    file_uuid: Optional[str] = None
    url: Optional[str] = None
    source: str = Field(
        ...,
        description="work_order | sop | engineering_drawing | material",
    )
    drawing_code: Optional[str] = None
    drawing_revision: Optional[str] = None


class StationSopStep(BaseModel):
    """工位可读工步（由 flow_config 展开，不依赖前端解析 ReactFlow）。"""

    id: str
    type: str = "step"
    title: str
    description: Optional[str] = None
    key_points: Optional[str] = None
    attachment_uuids: List[str] = Field(default_factory=list)


class StationSopDocument(BaseModel):
    """工位 ESOP：备注 content + 展开工步 steps（主）+ 原始 flow_config（辅）。"""

    uuid: str
    name: Optional[str] = None
    version: Optional[str] = None
    content: Optional[str] = Field(None, description="备注/富文本；工步正文以 steps 为准")
    steps: List[StationSopStep] = Field(
        default_factory=list,
        description="有序工步列表（已跳过开始/结束节点）",
    )
    flow_config: Optional[Dict[str, Any]] = Field(
        None,
        description="SOP 设计页原始流程（nodes/edges），可选",
    )
    attachments: List[StationDocFileItem] = Field(default_factory=list)


class StationOperationDocumentsResponse(BaseModel):
    """工单工序文档聚合：物料感知 SOP + 工程图纸 + 物料附件 + 工单附件。"""

    work_order_id: int
    operation_id: int
    master_operation_id: Optional[int] = None
    material_uuid: Optional[str] = None
    process_route_uuid: Optional[str] = None
    operation_uuid: Optional[str] = None
    sop: Optional[StationSopDocument] = None
    drawings: List[StationDocFileItem] = Field(default_factory=list)
    esop_available: bool = False
    drawings_available: bool = False


class StationWorkOrderDocumentFlags(BaseModel):
    work_order_id: int
    has_esop: bool = False
    has_drawings: bool = False
    has_docs: bool = False


class StationWorkOrderDocumentFlagsResponse(BaseModel):
    items: List[StationWorkOrderDocumentFlags] = Field(default_factory=list)
