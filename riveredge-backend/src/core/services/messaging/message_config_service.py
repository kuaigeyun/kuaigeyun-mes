"""
消息配置管理服务模块

提供消息配置的 CRUD 操作。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.message_config import MessageConfig
from core.utils.search_utils import apply_keyword_icontains
from core.schemas.message_config import (
    MessageConfigCreate, 
    MessageConfigUpdate, 
    MessageConfigTestRequest,
    MessageConfigTestResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from loguru import logger
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat


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
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
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

        query = apply_keyword_icontains(query, keyword, ["name", "code", "description"])
        
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
        message_config.deleted_at = resolve_business_datetime()
        await message_config.save()
    
    INTERNAL_DEFAULT_CONFIG_CODE = "default_internal"

    @staticmethod
    async def ensure_default_internal_config(tenant_id: int) -> MessageConfig:
        """确保租户存在站内信默认配置（无 SMTP 等参数，仅用于落库与收件箱）。"""
        existing = await MessageConfigService.get_default_config(tenant_id, "internal")
        if existing:
            return existing
        try:
            return await MessageConfigService.create_message_config(
                tenant_id,
                MessageConfigCreate(
                    name="站内信（系统默认）",
                    code=MessageConfigService.INTERNAL_DEFAULT_CONFIG_CODE,
                    type="internal",
                    description="系统自动创建，用于站内信投递",
                    config={},
                    is_active=True,
                    is_default=True,
                ),
            )
        except ValidationError:
            # 并发创建时可能已存在同 code，再取默认
            row = await MessageConfig.filter(
                tenant_id=tenant_id,
                code=MessageConfigService.INTERNAL_DEFAULT_CONFIG_CODE,
                deleted_at__isnull=True,
            ).first()
            if row:
                if not row.is_default:
                    row.is_default = True
                    row.is_active = True
                    await row.save()
                return row
            fallback = await MessageConfigService.get_default_config(tenant_id, "internal")
            if fallback:
                return fallback
            raise

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
                # 短信供应商未书面确认接入前禁止模拟成功（INF-04）
                success, message, error = (
                    False,
                    "短信通道未接入真实供应商，禁止模拟成功",
                    "SMS_PROVIDER_NOT_CONFIGURED",
                )
            elif data.type == "push":
                success, message, error = await MessageConfigService._send_test_push(
                    data.config, data.target, tenant_id
                )
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
    async def _send_test_push(config: dict, target: str, tenant_id: int) -> tuple[bool, str, Optional[str]]:
        """发送一条最小推送测试；企业微信凭据始终从应用连接器读取。"""
        channel = config or {}
        provider = str(channel.get("provider") or channel.get("connection_type") or "").strip().lower()
        content = "RiverEdge 消息渠道测试"

        if provider in ("wecom", "wechat_work", "企业微信"):
            from core.services.messaging.wecom_message_service import send_wecom_text_message

            user_ids = [v.strip() for v in target.replace(",", "|").split("|") if v.strip()]
            sent = await send_wecom_text_message(
                tenant_id=tenant_id,
                user_ids=user_ids,
                content=content,
            )
            return (
                (True, "企业微信测试消息已发送", None)
                if sent
                else (False, "企业微信未配置或测试目标无效", "请确认已启用 type=wecom 的应用连接器，并填写企微 UserID")
            )

        if provider in ("webhook", "http", "rest"):
            url = str(channel.get("webhook_url") or channel.get("url") or "").strip()
            if not url:
                return False, "推送配置缺少 webhook_url", "请填写应用 Webhook 地址"
            from infra.infrastructure.http.client import get_http_client

            headers = channel.get("headers") if isinstance(channel.get("headers"), dict) else None
            resp = await get_http_client().post(
                url,
                json={"title": "RiverEdge 消息渠道测试", "content": content, "recipient": target},
                headers=headers,
                timeout=10.0,
            )
            if resp.status_code >= 400:
                return False, "Webhook 测试失败", f"Webhook 返回 HTTP {resp.status_code}"
            return True, "应用 Webhook 测试消息已发送", None

        return False, "推送配置缺少 provider", "provider 仅支持 wecom 或 webhook"

    @staticmethod
    async def _send_test_email(config: dict, target: str) -> tuple[bool, str, Optional[str]]:
        """
        发送测试邮件内部方法
        """
        body = (
            f"这是一条来自 RiverEdge 系统的测试邮件。\n"
            f"发送时间：{to_api_isoformat(resolve_business_datetime())}\n"
            f"如果您收到这封邮件，说明您的 SMTP 配置正确。"
        )
        return await MessageConfigService._send_email(
            config,
            target,
            subject="RiverEdge 消息发送测试",
            content=body,
        )

    @staticmethod
    async def _send_email(
        config: dict,
        target: str,
        *,
        subject: str,
        content: str,
    ) -> tuple[bool, str, Optional[str]]:
        """发送业务/测试邮件：使用调用方提供的主题与正文。"""
        host = config.get("smtp_host")
        port = config.get("smtp_port", 465)
        username = config.get("smtp_username")
        password = config.get("smtp_password")
        use_tls = config.get("smtp_use_tls", True)
        from_name = config.get("from_name", "RiverEdge")

        if not all([host, username, password]):
            return False, "参数不完整", "缺少 host, username 或 password"
        if not target or not str(target).strip():
            return False, "收件人为空", "缺少收件邮箱"
        if not subject or not str(subject).strip():
            return False, "主题为空", "缺少邮件主题"
        if content is None or not str(content).strip():
            return False, "正文为空", "缺少邮件正文"

        try:
            import aiosmtplib
            message = MIMEMultipart()
            message["From"] = f"{from_name} <{username}>"
            message["To"] = str(target).strip()
            message["Subject"] = str(subject).strip()
            message.attach(MIMEText(str(content), "plain", "utf-8"))

            await aiosmtplib.send(
                message,
                hostname=host,
                port=port,
                username=username,
                password=password,
                use_tls=use_tls,
                timeout=10,
            )
            return True, "邮件已成功发送", None
        except Exception as e:
            logger.error(f"SMTP 发送失败: {e}")
            return False, "邮件发送失败", str(e)

