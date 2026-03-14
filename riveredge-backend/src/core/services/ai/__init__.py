"""
AI 服务模块

智能建议已迁移至 KU-AI 应用 (apps/kuaiai)。
此处保留 LLM 相关能力，供其他模块使用。
"""

from .llm import LLMService, LLMProvider, OpenAIProvider

__all__ = [
    "LLMService",
    "LLMProvider",
    "OpenAIProvider",
]
