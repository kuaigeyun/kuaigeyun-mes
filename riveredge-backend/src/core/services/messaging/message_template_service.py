"""
消息模板管理服务模块

提供消息模板的 CRUD 操作。
"""

from typing import Optional, List, Set
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.message_template import MessageTemplate
from core.schemas.message_template import MessageTemplateCreate, MessageTemplateUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError


class MessageTemplateService:
    """
    消息模板管理服务类
    
    提供消息模板的 CRUD 操作。
    """
    
    @staticmethod
    async def create_message_template(
        tenant_id: int,
        data: MessageTemplateCreate
    ) -> MessageTemplate:
        """
        创建消息模板
        
        Args:
            tenant_id: 组织ID
            data: 消息模板创建数据
            
        Returns:
            MessageTemplate: 创建的消息模板对象
            
        Raises:
            ValidationError: 当模板代码已存在时抛出
        """
        try:
            message_template = MessageTemplate(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await message_template.save()
            return message_template
        except IntegrityError:
            raise ValidationError(f"消息模板代码 {data.code} 已存在")
    
    @staticmethod
    async def get_message_template_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> MessageTemplate:
        """
        根据UUID获取消息模板
        
        Args:
            tenant_id: 组织ID
            uuid: 消息模板UUID
            
        Returns:
            MessageTemplate: 消息模板对象
            
        Raises:
            NotFoundError: 当消息模板不存在时抛出
        """
        message_template = await MessageTemplate.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not message_template:
            raise NotFoundError(f"消息模板不存在: {uuid}")
        
        return message_template

    @staticmethod
    async def get_message_template_by_code(
        tenant_id: int,
        code: str
    ) -> MessageTemplate:
        """
        根据模板代码获取消息模板
        
        Args:
            tenant_id: 组织ID
            code: 消息模板代码
            
        Returns:
            MessageTemplate: 消息模板对象
            
        Raises:
            NotFoundError: 当消息模板不存在时抛出
        """
        message_template = await MessageTemplate.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True
        ).first()
        
        if not message_template:
            raise NotFoundError(f"消息模板不存在: {code}")
        
        return message_template
    
    @staticmethod
    async def list_message_templates(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        is_active: Optional[bool] = None,
        installed_app_codes: Optional[Set[str]] = None,
    ) -> List[MessageTemplate]:
        """
        获取消息模板列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 消息类型筛选
            is_active: 是否启用筛选
            
        Returns:
            List[MessageTemplate]: 消息模板列表
        """
        query = MessageTemplate.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)

        if installed_app_codes is None:
            return await query.order_by("-created_at").offset(skip).limit(limit).all()

        from core.services.system.installed_feature_scope import (
            message_template_code_visible_for_installed_apps,
        )

        scan_cap = 4000
        rows = await query.order_by("-created_at").limit(scan_cap).all()
        filtered = [
            r
            for r in rows
            if message_template_code_visible_for_installed_apps(str(r.code or ""), installed_app_codes)
        ]
        return filtered[skip : skip + limit]
    
    @staticmethod
    async def update_message_template(
        tenant_id: int,
        uuid: str,
        data: MessageTemplateUpdate
    ) -> MessageTemplate:
        """
        更新消息模板
        
        Args:
            tenant_id: 组织ID
            uuid: 消息模板UUID
            data: 消息模板更新数据
            
        Returns:
            MessageTemplate: 更新后的消息模板对象
            
        Raises:
            NotFoundError: 当消息模板不存在时抛出
        """
        message_template = await MessageTemplateService.get_message_template_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(message_template, key, value)
        
        await message_template.save()
        return message_template
    
    @staticmethod
    async def delete_message_template(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除消息模板（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 消息模板UUID
            
        Raises:
            NotFoundError: 当消息模板不存在时抛出
        """
        message_template = await MessageTemplateService.get_message_template_by_uuid(tenant_id, uuid)
        message_template.deleted_at = datetime.now()
        await message_template.save()
    
    @staticmethod
    def _normalize_message_newlines(text: str) -> str:
        """将模板中误存为字面量的 \\n / \\r\\n 转为真实换行。"""
        if not text:
            return text
        return text.replace("\\r\\n", "\n").replace("\\n", "\n")

    @staticmethod
    def render_template(
        template: MessageTemplate,
        variables: dict
    ) -> tuple[str, str]:
        """
        渲染消息模板
        
        Args:
            template: 消息模板对象
            variables: 模板变量值
            
        Returns:
            tuple[str, str]: (subject, content) 渲染后的主题和内容
        """
        subject = MessageTemplateService._normalize_message_newlines(template.subject or "")
        content = MessageTemplateService._normalize_message_newlines(template.content or "")
        
        # 简单的变量替换（使用 {variable_name} 格式）
        for key, value in variables.items():
            placeholder = f"{{{key}}}"
            subject = subject.replace(placeholder, str(value))
            content = content.replace(placeholder, str(value))
        
        return subject, content

    # 中国中小制造业极简消息模板预设
    PRESET_MESSAGE_TEMPLATES = [
        {
            "name": "审批通过通知",
            "code": "approval_approved",
            "type": "email",
            "description": "审批通过时发送的通知邮件",
            "subject": "【审批通过】{title}",
            "content": "您好，\n\n您的审批申请「{title}」已通过。\n\n申请人：{submitter_name}\n审批人：{approver_name}\n通过时间：{approved_at}\n\n如有疑问请联系相关人员。",
            "variables": {
                "title": "审批标题",
                "submitter_name": "申请人",
                "approver_name": "审批人",
                "approved_at": "通过时间",
            },
            "is_active": True,
        },
        {
            "name": "审批驳回通知",
            "code": "approval_rejected",
            "type": "email",
            "description": "审批驳回时发送的通知邮件",
            "subject": "【审批驳回】{title}",
            "content": "您好，\n\n您的审批申请「{title}」已被驳回。\n\n申请人：{submitter_name}\n审批人：{approver_name}\n驳回时间：{rejected_at}\n驳回意见：{comment}\n\n请根据意见修改后重新提交。",
            "variables": {
                "title": "审批标题",
                "submitter_name": "申请人",
                "approver_name": "审批人",
                "rejected_at": "驳回时间",
                "comment": "驳回意见",
            },
            "is_active": True,
        },
    ]

    @staticmethod
    async def load_preset_sme(
        tenant_id: int,
        *,
        only_codes: Optional[Set[str]] = None,
    ) -> int:
        """
        加载中国中小制造业极简消息模板预设数据。
        仅创建不存在的模板（按 code 去重）。
        """
        from loguru import logger

        created = 0
        for item in MessageTemplateService.PRESET_MESSAGE_TEMPLATES:
            code = str(item.get("code") or "").strip()
            if not code:
                continue
            if only_codes is not None and code not in only_codes:
                continue
            exists = await MessageTemplate.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True,
            ).exists()
            if not exists:
                try:
                    data = MessageTemplateCreate(
                        name=item["name"],
                        code=item["code"],
                        type=item["type"],
                        description=item.get("description"),
                        subject=item.get("subject"),
                        content=item["content"],
                        variables=item.get("variables"),
                        is_active=item.get("is_active", True),
                    )
                    await MessageTemplateService.create_message_template(tenant_id, data)
                    created += 1
                except Exception as e:
                    logger.warning(f"创建消息模板 {item['code']} 失败: {e}")
        return created

