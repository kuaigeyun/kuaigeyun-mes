"""物料健康检查 Schema"""

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Literal, Optional


class MaterialHealthCheckRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    group_id: Optional[int] = Field(None, alias="groupId", description="限定物料分组（含子分组）")
    masters_only: bool = Field(True, alias="mastersOnly", description="仅检查主物料行")


class MaterialHealthMaterialRef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    uuid: str
    main_code: str = Field(alias="mainCode")
    name: str
    specification: Optional[str] = None


class MaterialHealthIssue(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    category: Literal[
        "completeness",
        "reasonableness",
        "duplicate_many_one_code",
        "duplicate_one_many_codes",
        "duplicate_similar",
    ]
    severity: Literal["error", "warning", "info"]
    title: str
    description: str
    materials: List[MaterialHealthMaterialRef] = Field(default_factory=list)
    field: Optional[str] = None


class MaterialHealthSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_materials: int = Field(alias="totalMaterials")
    issue_count: int = Field(alias="issueCount")
    completeness_count: int = Field(alias="completenessCount")
    duplicate_count: int = Field(alias="duplicateCount")
    health_score: int = Field(alias="healthScore", description="0-100，越高越健康")


class MaterialHealthCheckResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    summary: MaterialHealthSummary
    issues: List[MaterialHealthIssue]
