"""
AI智能建议服务模块

Author: Luigi Lu
Date: 2026-01-05
"""

from .suggestion_engine import (
    SuggestionEngine,
    Suggestion,
    SuggestionType,
    SuggestionPriority,
    get_suggestion_engine,
)
from .suggestion_service import SuggestionService

__all__ = [
    "SuggestionEngine",
    "Suggestion",
    "SuggestionType",
    "SuggestionPriority",
    "get_suggestion_engine",
    "SuggestionService",
]

