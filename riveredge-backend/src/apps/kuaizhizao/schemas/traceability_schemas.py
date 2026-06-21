"""
追溯管理 Schema（对齐 EPCIS 事件语义 + GB/T 报告结构）
"""

from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class TraceIdentifierType(str, Enum):
    serial = "serial"
    batch = "batch"
    work_order = "work_order"


class TraceBizStep(str, Enum):
    """GS1 CBV 业务步骤子集（内部事件分类）"""

    receiving = "receiving"
    commissioning = "commissioning"
    inspecting = "inspecting"
    picking = "picking"
    shipping = "shipping"
    accepting = "accepting"
    transforming = "transforming"
    storing = "storing"
    decommissioning = "decommissioning"
    other = "other"


TraceDirection = Literal["forward", "backward", "both"]


class TraceAnchorResponse(BaseModel):
    identifier_type: TraceIdentifierType = Field(..., alias="identifierType")
    code: str
    material_id: Optional[int] = Field(None, alias="materialId")
    material_code: Optional[str] = Field(None, alias="materialCode")
    material_name: Optional[str] = Field(None, alias="materialName")
    material_model: Optional[str] = Field(None, alias="materialModel")
    status: Optional[str] = None
    inbound_date: Optional[date] = Field(None, alias="inboundDate")
    serial_uuid: Optional[str] = Field(None, alias="serialUuid")
    batch_uuid: Optional[str] = Field(None, alias="batchUuid")
    work_order_id: Optional[int] = Field(None, alias="workOrderId")

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class TraceEventResponse(BaseModel):
    event_id: str = Field(..., alias="eventId")
    event_time: Optional[datetime] = Field(None, alias="eventTime")
    biz_step: TraceBizStep = Field(..., alias="bizStep")
    document_type: str = Field(..., alias="documentType")
    document_code: str = Field(..., alias="documentCode")
    document_id: Optional[int] = Field(None, alias="documentId")
    material_code: Optional[str] = Field(None, alias="materialCode")
    material_name: Optional[str] = Field(None, alias="materialName")
    quantity: Optional[Decimal] = None
    location: Optional[str] = None
    operator: Optional[str] = None
    remark: Optional[str] = None
    source_table: Optional[str] = Field(None, alias="sourceTable")
    quality_status: Optional[str] = Field(None, alias="qualityStatus")
    related_batch_no: Optional[str] = Field(None, alias="relatedBatchNo")

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class TraceNodeResponse(BaseModel):
    id: str
    label: str
    type: str
    data: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class TraceEdgeResponse(BaseModel):
    source: str
    target: str
    label: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class TraceSummaryResponse(BaseModel):
    event_count: int = Field(..., alias="eventCount")
    node_count: int = Field(..., alias="nodeCount")
    edge_count: int = Field(..., alias="edgeCount")
    time_from: Optional[datetime] = Field(None, alias="timeFrom")
    time_to: Optional[datetime] = Field(None, alias="timeTo")
    direction: TraceDirection

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class TraceProfileResponse(BaseModel):
    anchor: TraceAnchorResponse
    summary: TraceSummaryResponse
    events: List[TraceEventResponse]
    nodes: List[TraceNodeResponse]
    edges: List[TraceEdgeResponse]

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class TraceGraphResponse(BaseModel):
    """兼容旧 /graph 接口"""

    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

    model_config = ConfigDict(populate_by_name=True, by_alias=True)
