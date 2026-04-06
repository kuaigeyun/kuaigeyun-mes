"""组织级质检环节开关（IQC/IPQC/FQC/OQC）API Schema。"""

from typing import Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class QualityInspectionStageTogglesResponse(BaseSchema):
    """当前组织质检各环节的启用状态。"""

    iqc_enabled: bool = Field(..., description="来料检（IQC）环节是否启用")
    ipqc_enabled: bool = Field(..., description="过程检（IPQC）环节是否启用")
    fqc_enabled: bool = Field(..., description="成品检（FQC）环节是否启用")
    oqc_enabled: bool = Field(..., description="出货检（OQC）环节是否启用")


class QualityInspectionStageTogglesUpdate(BaseSchema):
    """部分更新；仅提交的字段会被覆盖，其余保持原配置。"""

    iqc_enabled: Optional[bool] = Field(None, description="来料检（IQC）")
    ipqc_enabled: Optional[bool] = Field(None, description="过程检（IPQC）")
    fqc_enabled: Optional[bool] = Field(None, description="成品检（FQC）")
    oqc_enabled: Optional[bool] = Field(None, description="出货检（OQC）")
