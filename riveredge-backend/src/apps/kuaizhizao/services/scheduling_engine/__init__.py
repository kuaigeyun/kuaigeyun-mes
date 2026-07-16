"""排产引擎：规则式贪心实现，预留求解器接口。"""

from apps.kuaizhizao.services.scheduling_engine.base import SchedulingEngine, SchedulingPlanRequest
from apps.kuaizhizao.services.scheduling_engine.greedy_rules_engine import GreedyRulesSchedulingEngine
from apps.kuaizhizao.services.scheduling_engine.registry import get_scheduling_engine

__all__ = [
    "SchedulingEngine",
    "SchedulingPlanRequest",
    "GreedyRulesSchedulingEngine",
    "get_scheduling_engine",
]
