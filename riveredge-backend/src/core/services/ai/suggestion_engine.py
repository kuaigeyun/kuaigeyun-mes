"""
AI智能建议引擎模块

提供统一的建议引擎接口，支持基于规则的智能建议生成。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Dict, Any, Optional
from enum import Enum
from dataclasses import dataclass
from datetime import datetime

from loguru import logger


class SuggestionType(str, Enum):
    """建议类型枚举"""
    INFO = "info"  # 信息提示
    WARNING = "warning"  # 警告
    ERROR = "error"  # 错误
    SUCCESS = "success"  # 成功提示
    OPTIMIZATION = "optimization"  # 优化建议


class SuggestionPriority(str, Enum):
    """建议优先级枚举"""
    LOW = "low"  # 低优先级
    MEDIUM = "medium"  # 中优先级
    HIGH = "high"  # 高优先级
    URGENT = "urgent"  # 紧急


@dataclass
class Suggestion:
    """
    建议数据类
    
    用于表示一个智能建议，包含建议的类型、优先级、内容等信息。
    """
    id: str  # 建议ID（唯一标识）
    type: SuggestionType  # 建议类型
    priority: SuggestionPriority  # 建议优先级
    title: str  # 建议标题
    content: str  # 建议内容
    action: Optional[str] = None  # 建议操作（可选，如跳转链接、操作按钮等）
    action_label: Optional[str] = None  # 操作按钮标签
    metadata: Optional[Dict[str, Any]] = None  # 元数据（可选，用于存储额外信息）
    created_at: datetime = None  # 创建时间
    
    def __post_init__(self):
        """初始化后处理"""
        if self.created_at is None:
            self.created_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "type": self.type.value,
            "priority": self.priority.value,
            "title": self.title,
            "content": self.content,
            "action": self.action,
            "action_label": self.action_label,
            "metadata": self.metadata or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SuggestionRule:
    """
    建议规则基类
    
    所有建议规则都应该继承此类，实现 `check` 方法来生成建议。
    """
    
    def __init__(self, rule_id: str, rule_name: str):
        """
        初始化建议规则
        
        Args:
            rule_id: 规则ID（唯一标识）
            rule_name: 规则名称
        """
        self.rule_id = rule_id
        self.rule_name = rule_name
    
    async def check(self, tenant_id: int, context: Dict[str, Any]) -> List[Suggestion]:
        """
        检查并生成建议
        
        Args:
            tenant_id: 组织ID
            context: 上下文信息（包含业务场景相关的数据）
            
        Returns:
            List[Suggestion]: 建议列表
        """
        raise NotImplementedError("子类必须实现 check 方法")


class SuggestionEngine:
    """
    建议引擎
    
    统一管理所有建议规则，根据业务场景生成建议。
    """
    
    def __init__(self):
        """初始化建议引擎"""
        self.rules: Dict[str, List[SuggestionRule]] = {}
    
    def register_rule(self, scene: str, rule: SuggestionRule):
        """
        注册建议规则
        
        Args:
            scene: 业务场景（如：init、work_order、reporting等）
            rule: 建议规则实例
        """
        if scene not in self.rules:
            self.rules[scene] = []
        self.rules[scene].append(rule)
        logger.debug(f"注册建议规则: {scene}.{rule.rule_id}")
    
    def register_rules(self, scene: str, rules: List[SuggestionRule]):
        """
        批量注册建议规则
        
        Args:
            scene: 业务场景
            rules: 建议规则列表
        """
        for rule in rules:
            self.register_rule(scene, rule)
    
    async def get_suggestions(
        self,
        tenant_id: int,
        scene: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Suggestion]:
        """
        获取建议列表
        
        Args:
            tenant_id: 组织ID
            scene: 业务场景
            context: 上下文信息（可选）
            
        Returns:
            List[Suggestion]: 建议列表（按优先级排序）
        """
        if context is None:
            context = {}
        
        suggestions = []
        
        # 获取该场景的所有规则
        scene_rules = self.rules.get(scene, [])
        
        # 执行所有规则检查
        for rule in scene_rules:
            try:
                rule_suggestions = await rule.check(tenant_id, context)
                suggestions.extend(rule_suggestions)
            except Exception as e:
                logger.error(f"执行建议规则失败: {scene}.{rule.rule_id}, 错误: {e}")
        
        # 按优先级排序（urgent > high > medium > low）
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


# 全局建议引擎实例
_suggestion_engine: Optional[SuggestionEngine] = None


def get_suggestion_engine() -> SuggestionEngine:
    """
    获取全局建议引擎实例（单例模式）
    
    Returns:
        SuggestionEngine: 建议引擎实例
    """
    global _suggestion_engine
    if _suggestion_engine is None:
        _suggestion_engine = SuggestionEngine()
    return _suggestion_engine

