"""排产引擎协议与请求结构。"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional, Protocol


@dataclass
class SchedulingPlanRequest:
    tenant_id: int
    work_order_ids: List[int] = field(default_factory=list)
    scope: str = "selected"
    plan_date: Optional[date] = None
    updated_by: Optional[int] = None


class SchedulingEngine(Protocol):
    async def plan(self, request: SchedulingPlanRequest) -> Dict[str, Any]:
        """生成排产提案（不落库）。"""
        ...
