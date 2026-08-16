"""图档反查 Schema"""

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from apps.master_data.schemas.drawing_schemas import EngineeringDrawingResponse


class DrawingWhereUsedUsage(BaseModel):
    kind: str
    uuid: str
    code: str
    name: str
    extra: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class DrawingWhereUsedResponse(BaseModel):
    direction: str
    drawings: List[EngineeringDrawingResponse] = Field(default_factory=list)
    usages: List[DrawingWhereUsedUsage] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)
