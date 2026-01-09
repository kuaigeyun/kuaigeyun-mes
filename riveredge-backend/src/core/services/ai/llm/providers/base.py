"""
LLM 提供商基类

定义统一的 LLM 提供商接口。

Author: Luigi Lu
Date: 2026-01-09
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class LLMMessage:
    """LLM 消息数据类"""
    role: str  # system, user, assistant
    content: str


@dataclass
class LLMResponse:
    """LLM 响应数据类"""
    content: str
    model: str
    usage: Optional[Dict[str, Any]] = None  # token 使用情况
    finish_reason: Optional[str] = None


class LLMProvider(ABC):
    """
    LLM 提供商基类
    
    所有 LLM 提供商必须实现此接口。
    """
    
    def __init__(self, api_key: str, model: str, base_url: Optional[str] = None, **kwargs):
        """
        初始化 LLM 提供商
        
        Args:
            api_key: API 密钥
            model: 模型名称
            base_url: API 基础 URL（可选，用于代理或自定义端点）
            **kwargs: 其他提供商特定参数
        """
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.config = kwargs
    
    @abstractmethod
    async def chat_completion(
        self,
        messages: List[LLMMessage],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> LLMResponse:
        """
        聊天补全
        
        Args:
            messages: 消息列表
            temperature: 温度参数（0-2，控制随机性）
            max_tokens: 最大 token 数
            **kwargs: 其他提供商特定参数
            
        Returns:
            LLMResponse: LLM 响应
        """
        pass
    
    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> str:
        """
        生成文本（简化接口）
        
        Args:
            prompt: 用户提示
            system_prompt: 系统提示（可选）
            temperature: 温度参数
            max_tokens: 最大 token 数
            **kwargs: 其他提供商特定参数
            
        Returns:
            str: 生成的文本
        """
        pass
