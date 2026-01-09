"""
大语言模型服务模块

提供统一的 LLM 调用接口，支持多种提供商（OpenAI、Claude、本地模型等）。

Author: Luigi Lu
Date: 2026-01-09
"""

from .llm_service import LLMService
from .providers.base import LLMProvider
from .providers.openai_provider import OpenAIProvider

__all__ = [
    "LLMService",
    "LLMProvider",
    "OpenAIProvider",
]
