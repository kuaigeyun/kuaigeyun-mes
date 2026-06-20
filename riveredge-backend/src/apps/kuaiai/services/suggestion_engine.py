"""
KU-AI 智能建议引擎模块

提供统一的建议引擎接口，支持基于规则的智能建议生成。
"""

from typing import List, Dict, Any, Optional
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

from loguru import logger
from core.utils.timezone_utils import to_api_isoformat


class SuggestionType(str, Enum):
    """建议类型枚举"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"
    OPTIMIZATION = "optimization"


class SuggestionPriority(str, Enum):
    """建议优先级枚举"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class Suggestion:
    """建议数据类"""
    id: str
    type: SuggestionType
    priority: SuggestionPriority
    title: str
    content: str
    action: Optional[str] = None
    action_label: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "priority": self.priority.value,
            "title": self.title,
            "content": self.content,
            "action": self.action,
            "action_label": self.action_label,
            "metadata": self.metadata or {},
            "created_at": to_api_isoformat(self.created_at) if self.created_at else None,
        }


class SuggestionRule:
    """建议规则基类"""

    def __init__(self, rule_id: str, rule_name: str):
        self.rule_id = rule_id
        self.rule_name = rule_name

    async def check(self, tenant_id: int, context: Dict[str, Any]) -> List[Suggestion]:
        raise NotImplementedError("子类必须实现 check 方法")


class SuggestionEngine:
    """建议引擎"""

    def __init__(self):
        self.rules: Dict[str, List[SuggestionRule]] = {}

    def register_rule(self, scene: str, rule: SuggestionRule):
        if scene not in self.rules:
            self.rules[scene] = []
        self.rules[scene].append(rule)
        logger.debug(f"注册建议规则: {scene}.{rule.rule_id}")

    def register_rules(self, scene: str, rules: List[SuggestionRule]):
        for rule in rules:
            self.register_rule(scene, rule)

    async def get_suggestions(
        self,
        tenant_id: int,
        scene: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Suggestion]:
        if context is None:
            context = {}

        suggestions = []
        scene_rules = self.rules.get(scene, [])

        for rule in scene_rules:
            try:
                rule_suggestions = await rule.check(tenant_id, context)
                suggestions.extend(rule_suggestions)
            except Exception as e:
                logger.error(f"执行建议规则失败: {scene}.{rule.rule_id}, 错误: {e}")

        priority_order = {
            SuggestionPriority.URGENT: 4,
            SuggestionPriority.HIGH: 3,
            SuggestionPriority.MEDIUM: 2,
            SuggestionPriority.LOW: 1,
        }
        suggestions.sort(
            key=lambda s: priority_order.get(s.priority, 0),
            reverse=True
        )
        return suggestions


_suggestion_engine: Optional[SuggestionEngine] = None


def get_suggestion_engine() -> SuggestionEngine:
    global _suggestion_engine
    if _suggestion_engine is None:
        _suggestion_engine = SuggestionEngine()
    return _suggestion_engine
