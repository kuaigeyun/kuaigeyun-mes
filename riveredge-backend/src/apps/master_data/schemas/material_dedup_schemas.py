"""物料防重助手 Schema"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class MaterialDedupCheckRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    match_fields: List[str] = Field(
        ...,
        min_length=1,
        alias="matchFields",
        description="参与精确比对的字段键：内置 name/specification/model/...；自定义 cf:{code}",
    )
    values: Dict[str, Any] = Field(
        default_factory=dict,
        description="字段键 → 待比对值（键与 matchFields 一致）",
    )
    exclude_uuid: Optional[str] = Field(
        None,
        alias="excludeUuid",
        description="编辑时排除自身",
    )
    masters_only: bool = Field(
        True,
        alias="mastersOnly",
        description="仅比对主物料（排除属性 SKU 子行）",
    )


class MaterialDedupMatchItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    uuid: str
    main_code: str = Field(alias="mainCode")
    name: str
    specification: Optional[str] = None
    model: Optional[str] = None


class MaterialDedupCheckResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    matched: bool
    matches: List[MaterialDedupMatchItem] = Field(default_factory=list)
    skipped: bool = Field(
        False,
        description="所选字段尚有空值，未执行比对",
    )
    skip_reason: Optional[str] = Field(None, alias="skipReason")
