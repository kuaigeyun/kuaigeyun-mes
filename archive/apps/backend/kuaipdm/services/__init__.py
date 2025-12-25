"""
PDM 服务模块

定义PDM相关的业务逻辑服务。
"""

from apps.kuaipdm.services.design_change_service import DesignChangeService
from apps.kuaipdm.services.engineering_change_service import EngineeringChangeService
from apps.kuaipdm.services.design_review_service import DesignReviewService
from apps.kuaipdm.services.research_process_service import ResearchProcessService
from apps.kuaipdm.services.knowledge_service import KnowledgeService

__all__ = [
    "DesignChangeService",
    "EngineeringChangeService",
    "DesignReviewService",
    "ResearchProcessService",
    "KnowledgeService",
]
