"""
PDM Schema 模块

定义PDM相关的Pydantic Schema，用于数据验证和序列化。
"""

from apps.kuaipdm.schemas.design_change_schemas import (
    DesignChangeCreate, DesignChangeUpdate, DesignChangeResponse
)
from apps.kuaipdm.schemas.engineering_change_schemas import (
    EngineeringChangeCreate, EngineeringChangeUpdate, EngineeringChangeResponse
)
from apps.kuaipdm.schemas.design_review_schemas import (
    DesignReviewCreate, DesignReviewUpdate, DesignReviewResponse
)
from apps.kuaipdm.schemas.research_process_schemas import (
    ResearchProcessCreate, ResearchProcessUpdate, ResearchProcessResponse
)
from apps.kuaipdm.schemas.knowledge_schemas import (
    KnowledgeCreate, KnowledgeUpdate, KnowledgeResponse
)

__all__ = [
    "DesignChangeCreate", "DesignChangeUpdate", "DesignChangeResponse",
    "EngineeringChangeCreate", "EngineeringChangeUpdate", "EngineeringChangeResponse",
    "DesignReviewCreate", "DesignReviewUpdate", "DesignReviewResponse",
    "ResearchProcessCreate", "ResearchProcessUpdate", "ResearchProcessResponse",
    "KnowledgeCreate", "KnowledgeUpdate", "KnowledgeResponse",
]
