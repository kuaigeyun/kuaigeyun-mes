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
from core.utils.timezone_utils import resolve_business_datetime


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
        message_template.deleted_at = resolve_business_datetime()
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

    # 中国中小制造业极简消息模板预设（一期仅站内信）
    PRESET_MESSAGE_TEMPLATES = [
        {
            "name": "审批待办通知",
            "code": "approval_pending",
            "type": "internal",
            "description": "有待审批任务时发送的站内信",
            "subject": "【待审批】{title}",
            "content": "您好，\n\n您有一个待审批申请「{title}」。\n\n提交人：{submitter_name}\n流程：{process_name}\n\n请尽快处理。",
            "variables": {
                "title": "审批标题",
                "submitter_name": "申请人",
                "process_name": "流程名称",
            },
            "is_active": True,
        },
        {
            "name": "审批催办通知",
            "code": "approval_urge",
            "type": "internal",
            "description": "审批催办/超时时发送的站内信",
            "subject": "【催办】{title}",
            "content": "您好，\n\n请尽快处理审批「{title}」。\n\n说明：{comment}\n流程：{process_name}",
            "variables": {
                "title": "审批标题",
                "comment": "催办说明",
                "process_name": "流程名称",
            },
            "is_active": True,
        },
        {
            "name": "审批通过通知",
            "code": "approval_approved",
            "type": "internal",
            "description": "审批通过时发送的站内信（默认少用，避免刷屏）",
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
            "type": "internal",
            "description": "审批驳回时发送的站内信",
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
        {
            "name": "销售交期延误",
            "code": "KZ_SALES_DELIVERY_DELAYED",
            "type": "internal",
            "description": "销售订单交期延误提醒",
            "subject": "【交期延误】销售订单 {order_code}",
            "content": "销售订单 {order_code} 已超过交货日期 {delivery_date}，客户：{customer_name}。\n请尽快跟进。",
            "variables": {
                "order_code": "订单号",
                "delivery_date": "交货日期",
                "customer_name": "客户",
            },
            "is_active": True,
        },
        {
            "name": "采购交期延误",
            "code": "KZ_PO_DELIVERY_DELAYED",
            "type": "internal",
            "description": "采购订单交期延误提醒",
            "subject": "【交期延误】采购订单 {order_code}",
            "content": "采购订单 {order_code} 已超过要求到货日期 {delivery_date}，供应商：{supplier_name}。\n请尽快跟进。",
            "variables": {
                "order_code": "订单号",
                "delivery_date": "到货日期",
                "supplier_name": "供应商",
            },
            "is_active": True,
        },
        {
            "name": "质量异常新建",
            "code": "KZ_QUALITY_EXCEPTION_CREATED",
            "type": "internal",
            "description": "质量异常提报/创建时提醒",
            "subject": "【质量异常】{exception_code}",
            "content": "新建质量异常：{exception_code}\n类型：{exception_type}\n严重度：{severity}\n物料：{material_name}\n描述：{problem_description}\n请尽快处理。",
            "variables": {
                "exception_code": "异常编号",
                "exception_type": "异常类型",
                "severity": "严重度",
                "material_name": "物料",
                "problem_description": "问题描述",
            },
            "is_active": True,
        },
        {
            "name": "设备故障报修",
            "code": "KZ_EQUIPMENT_FAULT_REPORTED",
            "type": "internal",
            "description": "设备故障报修提醒",
            "subject": "【设备报修】{equipment_label}",
            "content": "设备报修：{equipment_label}\n故障单号：{fault_no}\n级别：{fault_level}\n类型：{fault_type}\n描述：{fault_description}\n报告人：{reporter_name}",
            "variables": {
                "equipment_label": "设备",
                "fault_no": "故障单号",
                "fault_level": "级别",
                "fault_type": "类型",
                "fault_description": "描述",
                "reporter_name": "报告人",
            },
            "is_active": True,
        },
        {
            "name": "工单线边备料提醒",
            "code": "KZ_WO_REMIND_BATCHING",
            "type": "internal",
            "description": "提醒仓库线边备料",
            "subject": "【线边备料】工单 {work_order_code}",
            "content": "工单 {work_order_code} 需要线边备料。\n产品：{product_name}\n备料单：{batching_order_code}\n备注：{remarks}\n请到物料中心处理。",
            "variables": {
                "work_order_code": "工单号",
                "product_name": "产品",
                "batching_order_code": "备料单号",
                "remarks": "备注",
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

