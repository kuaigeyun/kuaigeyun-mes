"""排产引擎注册表。"""

from __future__ import annotations

from typing import Dict

from apps.kuaizhizao.services.scheduling_engine.base import SchedulingEngine
from apps.kuaizhizao.services.scheduling_engine.greedy_rules_engine import GreedyRulesSchedulingEngine

_ENGINES: Dict[str, SchedulingEngine] = {
    "greedy": GreedyRulesSchedulingEngine(),
}


def get_scheduling_engine(name: str = "greedy") -> SchedulingEngine:
    engine = _ENGINES.get(name)
    if engine is None:
        raise ValueError(f"未知排产引擎: {name}")
    return engine
