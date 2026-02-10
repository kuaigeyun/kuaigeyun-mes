"""
消息配置管理服务模块

提供消息配置的 CRUD 操作。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.message_config import MessageConfig
from core.schemas.message_config import (
    MessageConfigCreate, 
    MessageConfigUpdate, 
    MessageConfigTestRequest,
    MessageConfigTestResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from loguru import logger


class MessageConfigService:
    """
    消息配置管理服务类
    
    提供消息配置的 CRUD 操作。
    """
    
    @staticmethod
    async def create_message_config(
        tenant_id: int,
        data: MessageConfigCreate
    ) -> MessageConfig:
        """
        创建消息配置
        
        Args:
            tenant_id: 组织ID
            data: 消息配置创建数据
            
        Returns:
            MessageConfig: 创建的消息配置对象
            
        Raises:
            ValidationError: 当配置代码已存在时抛出
        """
        try:
            message_config = MessageConfig(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await message_config.save()
            return message_config
        except IntegrityError:
            raise ValidationError(f"消息配置代码 {data.code} 已存在")
    
    @staticmethod
    async def get_message_config_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> MessageConfig:
        """
        根据UUID获取消息配置
        
        Args:
            tenant_id: 组织ID
            uuid: 消息配置UUID
            
        Returns:
            MessageConfig: 消息配置对象
            
        Raises:
            NotFoundError: 当消息配置不存在时抛出
        """
        message_config = await MessageConfig.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not message_config:
            raise NotFoundError("消息配置不存在")
        
        return message_config
    
    @staticmethod
    async def list_message_configs(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[MessageConfig]:
        """
        获取消息配置列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 消息类型筛选
            is_active: 是否启用筛选
            
        Returns:
            List[MessageConfig]: 消息配置列表
        """
        query = MessageConfig.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_message_config(
        tenant_id: int,
        uuid: str,
        data: MessageConfigUpdate
    ) -> MessageConfig:
        """
        更新消息配置
        
        Args:
            tenant_id: 组织ID
            uuid: 消息配置UUID
            data: 消息配置更新数据
            
        Returns:
            MessageConfig: 更新后的消息配置对象
            
        Raises:
            NotFoundError: 当消息配置不存在时抛出
        """
        message_config = await MessageConfigService.get_message_config_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(message_config, key, value)
        
        await message_config.save()
        return message_config
    
    @staticmethod
    async def delete_message_config(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除消息配置（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 消息配置UUID
            
        Raises:
            NotFoundError: 当消息配置不存在时抛出
        """
        message_config = await MessageConfigService.get_message_config_by_uuid(tenant_id, uuid)
        message_config.deleted_at = datetime.now()
        await message_config.save()
    
    @staticmethod
    async def get_default_config(
        tenant_id: int,
        type: str
    ) -> Optional[MessageConfig]:
        """
        获取默认消息配置
        
        Args:
            tenant_id: 组织ID
            type: 消息类型
            
        Returns:
            Optional[MessageConfig]: 默认消息配置，如果不存在返回 None
        """
        return await MessageConfig.filter(
            tenant_id=tenant_id,
            type=type,
            is_default=True,
            is_active=True,
            deleted_at__isnull=True
        ).first()

    @staticmethod
    async def test_connection(
        tenant_id: int,
        data: MessageConfigTestRequest
    ) -> MessageConfigTestResponse:
        """
        测试消息配置连接
        
        Args:
            tenant_id: 组织ID
            data: 测试请求数据
            
        Returns:
            MessageConfigTestResponse: 测试结果
        """
        try:
            if data.type == "email":
                success, message, error = await MessageConfigService._send_test_email(data.config, data.target)
            elif data.type == "sms":
                # 短信测试逻辑暂未真实实现，先模拟成功
                success, message, error = True, "短信配置验证通过（模拟）", None
            else:
                success, message, error = False, f"不支持测试的消息类型: {data.type}", None
                
            return MessageConfigTestResponse(
                success=success,
                message=message,
                error_detail=error
            )
        except Exception as e:
            return MessageConfigTestResponse(
                success=False,
                message=f"系统错误: {str(e)}",
                error_detail=str(e)
            )

    @staticmethod
    async def _send_test_email(config: dict, target: str) -> tuple[bool, str, Optional[str]]:
        """
        发送测试邮件内部方法
        """
        host = config.get("smtp_host")
        port = config.get("smtp_port", 465)
        username = config.get("smtp_username")
        password = config.get("smtp_password")
        use_tls = config.get("smtp_use_tls", True)
        from_name = config.get("from_name", "RiverEdge Test")

        if not all([host, username, password]):
            return False, "参数不完整", "缺少 host, username 或 password"

        try:
            message = MIMEMultipart()
            message["From"] = f"{from_name} <{username}>"
            message["To"] = target
            message["Subject"] = "RiverEdge 消息发送测试"
            
            body = f"这是一条来自 RiverEdge 系统的测试邮件。\n发送时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n如果您收到这封邮件，说明您的 SMTP 配置正确。"
            message.attach(MIMEText(body, "plain", "utf-8"))

            await aiosmtplib.send(
                message,
                hostname=host,
                port=port,
                username=username,
                password=password,
                use_tls=use_tls,
                timeout=10
            )
            return True, "测试邮件已成功发送", None
        except Exception as e:
            logger.error(f"SMTP 测试失败: {e}")
            return False, "邮件发送失败", str(e)

