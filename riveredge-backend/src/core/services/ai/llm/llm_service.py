"""
大语言模型服务

提供统一的 LLM 调用接口，支持多种提供商。

Author: Luigi Lu
Date: 2026-01-09
"""

import os
from typing import List, Optional, Dict, Any
from loguru import logger

from .providers.base import LLMProvider, LLMMessage, LLMResponse
from .providers.openai_provider import OpenAIProvider


class LLMService:
    """
    大语言模型服务
    
    提供统一的 LLM 调用接口，自动选择配置的提供商。
    """
    
    _provider: Optional[LLMProvider] = None
    _provider_name: Optional[str] = None
    
    @classmethod
    def _get_provider(cls) -> LLMProvider:
        """
        获取 LLM 提供商实例（单例模式）
        
        Returns:
            LLMProvider: LLM 提供商实例
        """
        if cls._provider is None:
            # 从环境变量获取配置
            provider_name = os.getenv("LLM_PROVIDER", "deepseek").lower()
            
            if provider_name == "deepseek":
                api_key = os.getenv("DEEPSEEK_API_KEY")
                if not api_key:
                    raise ValueError("DEEPSEEK_API_KEY 环境变量未设置")
                
                model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
                base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
                
                cls._provider = OpenAIProvider(
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                )
                cls._provider_name = "deepseek"
                logger.info(f"✅ LLM 服务已初始化: DeepSeek ({model})")
            
            elif provider_name == "openai":
                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    raise ValueError("OPENAI_API_KEY 环境变量未设置")
                
                model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
                base_url = os.getenv("OPENAI_BASE_URL")  # 可选，用于代理
                
                cls._provider = OpenAIProvider(
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                )
                cls._provider_name = "openai"
                logger.info(f"✅ LLM 服务已初始化: OpenAI ({model})")
            
            elif provider_name == "claude":
                # TODO: 实现 Claude Provider
                raise NotImplementedError("Claude Provider 尚未实现")
            
            elif provider_name == "local":
                # TODO: 实现本地模型 Provider
                raise NotImplementedError("本地模型 Provider 尚未实现")
            
            else:
                raise ValueError(f"不支持的 LLM 提供商: {provider_name}")
        
        return cls._provider
    
    @classmethod
    async def chat_completion(
        cls,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> LLMResponse:
        """
        聊天补全
        
        Args:
            messages: 消息列表，格式：[{"role": "user", "content": "..."}]
            temperature: 温度参数（0-2，控制随机性）
            max_tokens: 最大 token 数
            **kwargs: 其他提供商特定参数
            
        Returns:
            LLMResponse: LLM 响应
        """
        provider = cls._get_provider()
        
        # 转换消息格式
        llm_messages = [
            LLMMessage(role=msg["role"], content=msg["content"])
            for msg in messages
        ]
        
        return await provider.chat_completion(
            messages=llm_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
    
    @classmethod
    async def generate_text(
        cls,
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
        provider = cls._get_provider()
        
        return await provider.generate_text(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
    
    @classmethod
    async def generate_suggestions(
        cls,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
    ) -> str:
        """
        生成建议（业务场景专用）
        
        Args:
            prompt: 用户提示
            context: 上下文信息（可选）
            temperature: 温度参数
            max_tokens: 最大 token 数
            
        Returns:
            str: 生成的建议文本
        """
        # 构建系统提示
        system_prompt = "你是一个专业的业务分析助手，能够根据提供的信息给出准确、有用的建议。"
        
        # 如果有上下文，添加到提示中
        if context:
            context_str = "\n".join([f"- {k}: {v}" for k, v in context.items()])
            full_prompt = f"{prompt}\n\n上下文信息：\n{context_str}"
        else:
            full_prompt = prompt
        
        return await cls.generate_text(
            prompt=full_prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
