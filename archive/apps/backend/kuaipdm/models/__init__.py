"""
PDM 数据模型模块

定义PDM相关的数据模型，用于研发管理。
"""

from apps.kuaipdm.models.design_change import DesignChange
from apps.kuaipdm.models.engineering_change import EngineeringChange
from apps.kuaipdm.models.design_review import DesignReview
from apps.kuaipdm.models.research_process import ResearchProcess
from apps.kuaipdm.models.knowledge import Knowledge

__all__ = [
    "DesignChange",
    "EngineeringChange",
    "DesignReview",
    "ResearchProcess",
    "Knowledge",
]
