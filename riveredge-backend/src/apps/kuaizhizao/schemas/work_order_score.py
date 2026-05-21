"""
工单综合打分 Schema
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class WorkOrderScoreBreakdownItem(BaseModel):
    """单维度打分明细"""

    raw: Optional[Any] = Field(None, description="原始值")
    score: float = Field(..., description="归一化分 0-100")
    weight: float = Field(..., description="权重")
    weighted: float = Field(..., description="加权贡献")
    critical_ratio: Optional[float] = Field(None, description="交期 CR（仅 due_urgency）")


class WorkOrderScoreResponse(BaseModel):
    """工单综合打分响应"""

    work_order_id: int
    scenario: str
    composite_score: float
    rank_band: str
    breakdown: Dict[str, Any] = Field(default_factory=dict, description="维度分解")
    computed_at: datetime
    config_version: str = "default-v1"


class WorkOrderScoreProfileWeights(BaseModel):
    """场景权重模板"""

    manual_priority: float = 0.25
    due_urgency: float = 0.35
    demand_urgency: float = 0.15
    kitting_readiness: float = 0.20
    plan_fidelity: float = 0.05


class WorkOrderScoreProfile(BaseModel):
    """单场景评分配置"""

    weights: WorkOrderScoreProfileWeights
    kitting_mode: str = Field("direct", description="direct=齐套高优先; invert=齐套低优先(备料)")


class WorkOrderScoreConfigResponse(BaseModel):
    """租户工单评分配置"""

    score_enabled: bool = True
    stale_minutes: int = 30
    profiles: Dict[str, WorkOrderScoreProfile]


class WorkOrderBatchScoreRefreshRequest(BaseModel):
    """批量刷新打分请求"""

    work_order_ids: Optional[List[int]] = Field(None, description="工单ID列表，空则刷新全部 released 工单")
    scenarios: Optional[List[str]] = Field(None, description="场景列表，默认 scheduling+picking")


class WorkOrderListScoreSummary(BaseModel):
    """列表页打分摘要"""

    scheduling_score: Optional[float] = None
    picking_score: Optional[float] = None
    scheduling_rank_band: Optional[str] = None
    picking_rank_band: Optional[str] = None
