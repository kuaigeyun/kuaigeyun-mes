"""快视觉 API Schema。"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Literal, Optional

from pydantic import Field

from core.schemas.base import BaseSchema

Judgment = Literal["OK", "NG", "UNKNOWN"]
RecipeType = Literal["thickness_measure", "step_compliance"]
RecipeVersionStatus = Literal["draft", "published", "obsolete"]
SdkType = Literal["hik_mvs", "basler_pylon", "genicam", "external_only"]
ReviewStatus = Literal["pending", "done"]


class MeasurementIn(BaseSchema):
    name: str = Field(..., max_length=80)
    value: Optional[Decimal] = None
    unit: Optional[str] = Field(None, max_length=20)


class IngestPayload(BaseSchema):
    event_id: str = Field(..., max_length=100)
    occurred_at: Optional[datetime] = None
    judgment: Judgment
    confidence: Optional[Decimal] = None
    recipe_code: Optional[str] = Field(None, max_length=50)
    recipe_version: Optional[str] = Field(None, max_length=30)
    station_code: Optional[str] = Field(None, max_length=50)
    camera_code: Optional[str] = Field(None, max_length=50)
    work_order_code: Optional[str] = Field(None, max_length=50)
    operation_code: Optional[str] = Field(None, max_length=50)
    batch_no: Optional[str] = Field(None, max_length=100)
    duration_ms: Optional[int] = None
    measurements: List[MeasurementIn] = Field(default_factory=list)
    image_refs: List[str] = Field(default_factory=list)
    step_results: Optional[dict] = None
    remark: Optional[str] = None


class IngestBatchPayload(BaseSchema):
    items: List[IngestPayload] = Field(..., min_length=1, max_length=100)


class IngestResponse(BaseSchema):
    accepted: int
    duplicated: int = 0
    event_uuid: Optional[str] = None
    message: str = "ok"


class IngestBatchResponse(BaseSchema):
    accepted: int
    duplicated: int
    failed: int = 0


class MeasurementOut(BaseSchema):
    name: str
    value: Optional[Decimal] = None
    unit: Optional[str] = None


class InspectionImageOut(BaseSchema):
    object_key: str
    label: Optional[str] = None
    sort_order: int = 0


class InspectionListItem(BaseSchema):
    uuid: str
    event_id: str
    occurred_at: datetime
    judgment: str
    confidence: Optional[Decimal] = None
    recipe_code: Optional[str] = None
    recipe_version: Optional[str] = None
    station_code: Optional[str] = None
    camera_code: Optional[str] = None
    agent_code: Optional[str] = None
    duration_ms: Optional[int] = None
    work_order_code: Optional[str] = None
    batch_no: Optional[str] = None
    thickness_mm: Optional[Decimal] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class InspectionListResponse(BaseSchema):
    items: List[InspectionListItem]
    total: int
    page: int
    page_size: int


class InspectionDetail(InspectionListItem):
    operation_code: Optional[str] = None
    duration_ms: Optional[int] = None
    step_results: Optional[dict] = None
    remark: Optional[str] = None
    measurements: List[MeasurementOut] = Field(default_factory=list)
    images: List[InspectionImageOut] = Field(default_factory=list)


class AgentCreate(BaseSchema):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    run_mode: Literal["external_forward", "local_pipeline"] = "local_pipeline"
    remark: Optional[str] = None
    is_enabled: bool = True


class AgentUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=100)
    run_mode: Optional[Literal["external_forward", "local_pipeline"]] = None
    remark: Optional[str] = None
    is_enabled: Optional[bool] = None


class AgentResponse(BaseSchema):
    uuid: str
    id: int
    code: str
    name: str
    device_token: str
    is_enabled: bool
    is_online: bool = False
    last_heartbeat_at: Optional[datetime] = None
    config_version: int
    run_mode: str = "local_pipeline"
    agent_version: Optional[str] = None
    last_error: Optional[str] = None
    buffer_pending_count: int = 0
    disk_free_mb: Optional[int] = None
    remark: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AgentListResponse(BaseSchema):
    items: List[AgentResponse]
    total: int
    page: int
    page_size: int


class DashboardSummary(BaseSchema):
    events_today: int
    ok_today: int
    ng_today: int
    unknown_today: int
    ok_rate_today: Optional[float] = None
    agent_count: int
    agent_enabled: int
    pending_reviews: int = 0
    last_agent_heartbeat_at: Optional[datetime] = None


class CameraCreate(BaseSchema):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    sdk_type: SdkType = "external_only"
    serial_no: Optional[str] = Field(None, max_length=100)
    station_code: Optional[str] = Field(None, max_length=50)
    plant_code: Optional[str] = Field(None, max_length=50)
    workshop_code: Optional[str] = Field(None, max_length=50)
    is_enabled: bool = True
    remark: Optional[str] = None


class CameraUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=100)
    sdk_type: Optional[SdkType] = None
    serial_no: Optional[str] = Field(None, max_length=100)
    station_code: Optional[str] = Field(None, max_length=50)
    plant_code: Optional[str] = Field(None, max_length=50)
    workshop_code: Optional[str] = Field(None, max_length=50)
    is_enabled: Optional[bool] = None
    remark: Optional[str] = None


class CameraResponse(BaseSchema):
    uuid: str
    id: int
    code: str
    name: str
    sdk_type: str
    serial_no: Optional[str] = None
    station_code: Optional[str] = None
    plant_code: Optional[str] = None
    workshop_code: Optional[str] = None
    is_enabled: bool
    remark: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CameraListResponse(BaseSchema):
    items: List[CameraResponse]
    total: int
    page: int
    page_size: int


class RecipeCreate(BaseSchema):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    recipe_type: RecipeType
    review_threshold: Optional[Decimal] = None
    default_camera_code: Optional[str] = Field(None, max_length=50)
    trigger_mode: Literal["manual", "interval", "gpio"] = "manual"
    trigger_interval_seconds: Optional[int] = None
    params: Optional[dict[str, Any]] = None
    version: str = Field(default="1.0", max_length=30)
    is_enabled: bool = True
    remark: Optional[str] = None


class RecipeUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=100)
    review_threshold: Optional[Decimal] = None
    default_camera_code: Optional[str] = Field(None, max_length=50)
    trigger_mode: Optional[Literal["manual", "interval", "gpio"]] = None
    trigger_interval_seconds: Optional[int] = None
    is_enabled: Optional[bool] = None
    remark: Optional[str] = None


class RecipeVersionCreate(BaseSchema):
    version: str = Field(..., max_length=30)
    params: Optional[dict[str, Any]] = None
    model_artifact_uuid: Optional[str] = None
    require_model: bool = False
    remark: Optional[str] = None


class RecipeVersionUpdate(BaseSchema):
    params: Optional[dict[str, Any]] = None
    model_artifact_uuid: Optional[str] = None
    require_model: Optional[bool] = None
    remark: Optional[str] = None


class RecipeVersionOut(BaseSchema):
    uuid: str
    id: int
    version: str
    status: str
    params: Optional[dict[str, Any]] = None
    model_artifact_id: Optional[int] = None
    model_artifact_uuid: Optional[str] = None
    model_artifact_code: Optional[str] = None
    require_model: bool = False
    published_at: Optional[datetime] = None
    published_by_name: Optional[str] = None
    remark: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RecipeResponse(BaseSchema):
    uuid: str
    id: int
    code: str
    name: str
    recipe_type: str
    review_threshold: Optional[Decimal] = None
    default_camera_code: Optional[str] = None
    trigger_mode: str = "manual"
    trigger_interval_seconds: Optional[int] = None
    is_enabled: bool
    remark: Optional[str] = None
    published_version: Optional[str] = None
    versions: List[RecipeVersionOut] = Field(default_factory=list)
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RecipeListItem(BaseSchema):
    uuid: str
    id: int
    code: str
    name: str
    recipe_type: str
    review_threshold: Optional[Decimal] = None
    default_camera_code: Optional[str] = None
    trigger_mode: str = "manual"
    trigger_interval_seconds: Optional[int] = None
    is_enabled: bool
    published_version: Optional[str] = None
    remark: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RecipeListResponse(BaseSchema):
    items: List[RecipeListItem]
    total: int
    page: int
    page_size: int


class ReviewComplete(BaseSchema):
    reviewed_judgment: Judgment
    reason: Optional[str] = None


class ReviewTaskItem(BaseSchema):
    uuid: str
    id: int
    status: str
    original_judgment: str
    reviewed_judgment: Optional[str] = None
    reason: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by_name: Optional[str] = None
    event_uuid: Optional[str] = None
    event_id: Optional[str] = None
    occurred_at: Optional[datetime] = None
    confidence: Optional[Decimal] = None
    recipe_code: Optional[str] = None
    station_code: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ReviewTaskListResponse(BaseSchema):
    items: List[ReviewTaskItem]
    total: int
    page: int
    page_size: int


class ReviewTaskDetail(ReviewTaskItem):
    images: List[InspectionImageOut] = Field(default_factory=list)
    measurements: List[MeasurementOut] = Field(default_factory=list)


class SettingsResponse(BaseSchema):
    require_published_recipe: bool = False
    offline_timeout_seconds: int = 60
    image_retention_days: int = 90
    event_retention_days: int = 180
    buffer_alert_threshold: int = 50
    disk_alert_mb: int = 1024


class SettingsUpdate(BaseSchema):
    require_published_recipe: Optional[bool] = None
    offline_timeout_seconds: Optional[int] = None
    image_retention_days: Optional[int] = None
    event_retention_days: Optional[int] = None
    buffer_alert_threshold: Optional[int] = None
    disk_alert_mb: Optional[int] = None


class ModelArtifactCreate(BaseSchema):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    framework: str = Field(default="onnx", max_length=30)
    object_key: str = Field(..., max_length=500)
    checksum: str = Field(..., max_length=128)
    input_width: Optional[int] = None
    input_height: Optional[int] = None
    label_map: Optional[dict[str, Any]] = None
    is_enabled: bool = True
    remark: Optional[str] = None


class ModelArtifactUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=100)
    framework: Optional[str] = Field(None, max_length=30)
    object_key: Optional[str] = Field(None, max_length=500)
    checksum: Optional[str] = Field(None, max_length=128)
    input_width: Optional[int] = None
    input_height: Optional[int] = None
    label_map: Optional[dict[str, Any]] = None
    is_enabled: Optional[bool] = None
    remark: Optional[str] = None


class ModelArtifactResponse(BaseSchema):
    uuid: str
    id: int
    code: str
    name: str
    framework: str
    object_key: str
    checksum: str
    input_width: Optional[int] = None
    input_height: Optional[int] = None
    label_map: Optional[dict[str, Any]] = None
    is_enabled: bool
    remark: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ModelArtifactListResponse(BaseSchema):
    items: List[ModelArtifactResponse]
    total: int
    page: int
    page_size: int


class SampleSetCreate(BaseSchema):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    recipe_code: Optional[str] = Field(None, max_length=50)
    is_enabled: bool = True
    remark: Optional[str] = None


class SampleSetUpdate(BaseSchema):
    name: Optional[str] = Field(None, max_length=100)
    recipe_code: Optional[str] = Field(None, max_length=50)
    is_enabled: Optional[bool] = None
    remark: Optional[str] = None


class SampleItemOut(BaseSchema):
    uuid: str
    id: int
    label: str
    object_key: str
    source_event_uuid: Optional[str] = None
    remark: Optional[str] = None
    created_at: Optional[datetime] = None


class SampleSetResponse(BaseSchema):
    uuid: str
    id: int
    code: str
    name: str
    recipe_code: Optional[str] = None
    is_enabled: bool
    item_count: int = 0
    remark: Optional[str] = None
    items: List[SampleItemOut] = Field(default_factory=list)
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SampleSetListItem(BaseSchema):
    uuid: str
    id: int
    code: str
    name: str
    recipe_code: Optional[str] = None
    is_enabled: bool
    item_count: int = 0
    remark: Optional[str] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SampleSetListResponse(BaseSchema):
    items: List[SampleSetListItem]
    total: int
    page: int
    page_size: int


class PromoteSampleRequest(BaseSchema):
    sample_set_uuid: Optional[str] = None
    sample_set_code: Optional[str] = Field(None, max_length=50)
    sample_set_name: Optional[str] = Field(None, max_length=100)
    label: Optional[str] = Field(None, max_length=30)
    recipe_code: Optional[str] = Field(None, max_length=50)


class SampleExportPack(BaseSchema):
    format: str = "kuaivision-sample-pack/v1"
    sample_set_code: str
    sample_set_name: str
    recipe_code: Optional[str] = None
    exported_at: datetime
    items: List[dict[str, Any]] = Field(default_factory=list)


class EdgeHeartbeatPayload(BaseSchema):
    agent_version: Optional[str] = Field(None, max_length=40)
    last_error: Optional[str] = None
    buffer_pending_count: int = 0
    disk_free_mb: Optional[int] = None


class EdgeHeartbeatResponse(BaseSchema):
    ok: bool = True
    config_version: int
    server_time: datetime


class EdgeModelConfig(BaseSchema):
    code: str
    framework: str = "onnx"
    object_key: str
    checksum: str
    input_width: Optional[int] = None
    input_height: Optional[int] = None
    label_map: Optional[dict[str, Any]] = None


class EdgeRecipeConfig(BaseSchema):
    code: str
    name: str
    recipe_type: str
    version: str
    review_threshold: Optional[Decimal] = None
    default_camera_code: Optional[str] = None
    trigger_mode: str = "manual"
    trigger_interval_seconds: Optional[int] = None
    params: Optional[dict[str, Any]] = None
    model: Optional[EdgeModelConfig] = None


class EdgeCameraConfig(BaseSchema):
    code: str
    name: str
    sdk_type: str
    serial_no: Optional[str] = None
    station_code: Optional[str] = None
    is_enabled: bool = True


class EdgeAgentConfigResponse(BaseSchema):
    agent_code: str
    agent_name: str
    run_mode: str
    config_version: int
    offline_timeout_seconds: int = 60
    require_published_recipe: bool = False
    cameras: List[EdgeCameraConfig] = Field(default_factory=list)
    recipes: List[EdgeRecipeConfig] = Field(default_factory=list)
