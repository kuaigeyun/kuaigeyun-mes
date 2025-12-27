"""
消息服务实现

将静态方法类 MessageService 适配为 MessageServiceInterface 接口实现。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Any, Dict
from core.services.interfaces.service_interface import MessageServiceInterface
from core.services.messaging.message_service import MessageService


class MessageServiceImpl(MessageServiceInterface):
    """
    消息服务实现类
    
    将 MessageService 的静态方法适配为接口实现。
    """
    
    @property
    def service_name(self) -> str:
        return "message_service"
    
    @property
    def service_version(self) -> str:
        return "1.0.0"
    
    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "status": "healthy",
            "service": "message_service",
            "version": self.service_version
        }
    
    async def send_message(
        self,
        tenant_id: int,
        request: Any
    ) -> Any:
        """发送消息"""
        return await MessageService.send_message(
            tenant_id=tenant_id,
            request=request
        )

