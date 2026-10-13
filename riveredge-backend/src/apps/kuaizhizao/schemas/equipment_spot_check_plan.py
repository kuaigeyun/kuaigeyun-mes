"""设备点检计划 Schema"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EquipmentSpotCheckPlanBase(BaseModel):
    plan_no: Optional[str] = Field(None, max_length=100, description="计划编号（可选，创建时自动生成）")
    plan_name: str = Field(..., min_length=1, max_length=200, description="计划名称")
    scheme_id: int = Field(..., description="点检方案ID")
    equipment_uuids: Optional[List[str]] = None
    cycle_type: Optional[str] = None
    shift_ids: Optional[List[int]] = None
    planned_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    status: str = Field(default="草稿", max_length=50, description="计划状态")
    remark: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = ["草稿", "已发布", "执行中", "已完成", "已取消"]
        if v not in allowed:
            raise ValueError(f"计划状态必须是 {allowed} 之一")
        return v


class EquipmentSpotCheckPlanCreate(EquipmentSpotCheckPlanBase):
    pass


class EquipmentSpotCheckPlanUpdate(BaseModel):
    plan_name: Optional[str] = Field(None, min_length=1, max_length=200)
    scheme_id: Optional[int] = None
    equipment_uuids: Optional[List[str]] = None
    cycle_type: Optional[str] = None
    shift_ids: Optional[List[int]] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    responsible_person_id: Optional[int] = None
    responsible_person_name: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=50)
    remark: Optional[str] = None
    attachments: Optional[List[dict]] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = ["草稿", "已发布", "执行中", "已完成", "已取消"]
        if v not in allowed:
            raise ValueError(f"计划状态必须是 {allowed} 之一")
        return v


class EquipmentSpotCheckPlanResponse(EquipmentSpotCheckPlanBase):
    model_config = ConfigDict(from_attributes=True)

    uuid: str
    id: int
    tenant_id: int
    equipment_id: Optional[int] = None
    equipment_uuid: Optional[str] = None
    equipment_name: Optional[str] = None
    equipment_items: Optional[List[Dict[str, Any]]] = None
    bound_equipment_count: Optional[int] = Field(
        None, description="计划设备数"
    )
    scheme_code: Optional[str] = None
    scheme_name: Optional[str] = None
    cycle_value: Optional[int] = None
    cycle_unit: Optional[str] = None
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    task_count: int = 0
    expected_task_count: int = 0
    has_published_snapshot: bool = False
    pending_count: int = 0
    submitted_count: int = 0
    completed_count: int = 0


class EquipmentSpotCheckPlanListResponse(BaseModel):
    items: List[EquipmentSpotCheckPlanResponse]
    total: int
    skip: int
    limit: int


class GenerateSpotChecksRequest(BaseModel):
    check_date: Optional[date] = Field(None, description="可选排程日期；不填则生成计划全部时段")
    equipment_uuids: Optional[List[str]] = Field(
        None, description="仅生成指定设备；不填则生成已发布计划的全部设备"
    )


class GenerateSpotChecksResponse(BaseModel):
    created: List[Dict[str, Any]]
    total: int
