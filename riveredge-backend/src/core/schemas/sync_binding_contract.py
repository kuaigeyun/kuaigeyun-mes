"""同步绑定 sources / 外推 targets 契约（入站、出站唯一 JSON 形态）。"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import Field, field_validator

from core.schemas.base import BaseSchema

SyncSourceKind = Literal["api", "dataset"]

UNI_AUDIT_PUSH_ACTIONS = frozenset({"submit", "approve"})


class SyncSourceItem(BaseSchema):
    kind: SyncSourceKind
    api_uuid: Optional[str] = None
    dataset_uuid: Optional[str] = None
    field_mapping: Dict[str, str] = Field(default_factory=dict)
    label: Optional[str] = Field(None, description="展示名（可选，错误信息用）")

    @field_validator("kind", mode="before")
    @classmethod
    def _kind(cls, value: Any) -> str:
        kind = str(value or "").strip().lower()
        if kind not in ("api", "dataset"):
            raise ValueError("来源 kind 须为 api 或 dataset")
        return kind


class DocumentPushTargetItem(BaseSchema):
    connection_code: Optional[str] = None
    save_api_uuid: Optional[str] = None
    target_profile: str
    """auto：绑定按钮后写出；manual：只在出站里勾选单据时写出。"""
    push_mode: str = "auto"
    trigger_actions: List[str] = Field(default_factory=list)
    """api：写入接口；data_source：数据源。"""
    destination_kind: str = "api"
    data_source_uuid: Optional[str] = None
    """destination_kind=data_source 时，用该写入数据集（sql_write）把单据行写入外部库。"""
    dataset_uuid: Optional[str] = None
    """仅用户在出站点过确认后写入。缺省或 false 的历史行不得再展示。"""
    user_saved: bool = False

    @field_validator("destination_kind", mode="before")
    @classmethod
    def _destination_kind(cls, value: Any) -> str:
        kind = str("api" if value is None else value).strip().lower()
        if kind not in ("api", "data_source"):
            raise ValueError("destination_kind 须为 api 或 data_source")
        return kind

    @field_validator("target_profile", mode="before")
    @classmethod
    def _profile(cls, value: Any) -> str:
        profile = str(value or "").strip()
        if not profile:
            raise ValueError("target_profile 不能为空")
        return profile


class DocumentPushBindingState(BaseSchema):
    """出站绑定：多目标 + 可选动作触发。"""

    targets: List[DocumentPushTargetItem] = Field(default_factory=list)
    trigger_actions: List[str] = Field(default_factory=list)
    sync_mode: str = "manual_full"
    schedule_interval_minutes: int = 15
