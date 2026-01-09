"""
OpenAI 提供商实现

实现 OpenAI API 的调用。

Author: Luigi Lu
Date: 2026-01-09
"""

from typing import List, Optional
from loguru import logger

try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    AsyncOpenAI = None

from .base import LLMProvider, LLMMessage, LLMResponse


class OpenAIProvider(LLMProvider):
    """
    OpenAI 兼容提供商
    
    支持 OpenAI API 和兼容 OpenAI API 的服务（如 DeepSeek）。
    通过 base_url 参数可以切换到不同的服务提供商。
    """
    
    def __init__(self, api_key: str, model: str, base_url: Optional[str] = None, **kwargs):
        """
        初始化 OpenAI 提供商
        
        Args:
            api_key: OpenAI API Key
            model: 模型名称（如：gpt-4o-mini, gpt-4-turbo）
            base_url: API 基础 URL（可选，用于代理服务）
            **kwargs: 其他参数
        """
        if not OPENAI_AVAILABLE:
            raise ImportError(
                "OpenAI SDK 未安装。请运行: uv pip install openai>=1.0.0"
            )
        
        super().__init__(api_key, model, base_url, **kwargs)
        
        # 初始化 OpenAI 客户端
        client_kwargs = {
            "api_key": self.api_key,
        }
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
        
        self.client = AsyncOpenAI(**client_kwargs)
    
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
            temperature: 温度参数
            max_tokens: 最大 token 数
            **kwargs: 其他参数
            
        Returns:
            LLMResponse: LLM 响应
        """
        try:
            # 转换消息格式
            openai_messages = [
                {"role": msg.role, "content": msg.content}
                for msg in messages
            ]
            
            # 调用 OpenAI API
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=openai_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
            
            # 提取响应内容
            content = response.choices[0].message.content
            finish_reason = response.choices[0].finish_reason
            
            # 提取使用情况
            usage = None
            if response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }
            
            return LLMResponse(
                content=content or "",
                model=response.model,
                usage=usage,
                finish_reason=finish_reason,
            )
        except Exception as e:
            logger.error(f"API 调用失败 ({self.model}): {e}")
            raise
    
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
            **kwargs: 其他参数
            
        Returns:
            str: 生成的文本
        """
        messages = []
        
        if system_prompt:
            messages.append(LLMMessage(role="system", content=system_prompt))
        
        messages.append(LLMMessage(role="user", content=prompt))
        
        response = await self.chat_completion(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        
        return response.content
