"""
消息模板管理服务模块

提供消息模板的 CRUD 操作。
"""

from typing import Optional, List, Set
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.message_template import MessageTemplate
from core.utils.search_utils import apply_keyword_icontains
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
        keyword: Optional[str] = None,
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

        query = apply_keyword_icontains(query, keyword, ["name", "code", "description", "subject"])

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
            "name": "订单评审已下达",
            "code": "KZ_SALES_REVIEW_ISSUED",
            "type": "internal",
            "description": "订单评审下达后通知相关部门",
            "subject": "【订单评审】{review_code} 已下达",
            "content": "订单评审 {review_code}（项目：{project_name}，客户：{customer_name}）已下达，请各部门尽快填写评审意见。",
            "variables": {
                "review_code": "评审单号",
                "project_name": "项目名称",
                "customer_name": "客户",
            },
            "is_active": True,
        },
        {
            "name": "订单评审已驳回",
            "code": "KZ_SALES_REVIEW_REJECTED",
            "type": "internal",
            "description": "订单评审被驳回后通知业务端",
            "subject": "【订单评审】{review_code} 已驳回",
            "content": "订单评审 {review_code}（项目：{project_name}，客户：{customer_name}）已被驳回。原因：{reject_reason}\n请修改后重新下达。",
            "variables": {
                "review_code": "评审单号",
                "project_name": "项目名称",
                "customer_name": "客户",
                "reject_reason": "驳回原因",
            },
            "is_active": True,
        },
        {
            "name": "订单评审已通过",
            "code": "KZ_SALES_REVIEW_PASSED",
            "type": "internal",
            "description": "各部门评审全部通过后通知业务端",
            "subject": "【订单评审】{review_code} 已通过",
            "content": "订单评审 {review_code}（项目：{project_name}，客户：{customer_name}）各部门已全部通过，可下推销售订单。",
            "variables": {
                "review_code": "评审单号",
                "project_name": "项目名称",
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
        {
            "name": "销售订单已审核",
            "code": "KZ_SO_APPROVED",
            "type": "internal",
            "description": "销售订单审核通过后提醒业务跟进",
            "subject": "【销售订单】{order_code} 已审核",
            "content": "销售订单 {order_code} 已审核通过。\n客户：{customer_name}\n交货日期：{delivery_date}\n请安排后续执行。",
            "variables": {
                "order_code": "订单号",
                "customer_name": "客户",
                "delivery_date": "交货日期",
            },
            "is_active": True,
        },
        {
            "name": "销售订单下推工单",
            "code": "KZ_SO_PUSHED_WO",
            "type": "internal",
            "description": "销售订单下推工单后通知创建人",
            "subject": "【下推工单】销售订单 {order_code}",
            "content": "销售订单 {order_code} 已下推工单。\n工单：{work_order_codes}\n客户：{customer_name}\n请跟进生产执行。",
            "variables": {
                "order_code": "订单号",
                "work_order_codes": "工单号",
                "customer_name": "客户",
            },
            "is_active": True,
        },
        {
            "name": "采购订单已审核",
            "code": "KZ_PO_APPROVED",
            "type": "internal",
            "description": "采购订单审核通过后提醒跟单",
            "subject": "【采购订单】{order_code} 已审核",
            "content": "采购订单 {order_code} 已审核通过。\n供应商：{supplier_name}\n要求到货：{delivery_date}\n请安排收货跟进。",
            "variables": {
                "order_code": "订单号",
                "supplier_name": "供应商",
                "delivery_date": "到货日期",
            },
            "is_active": True,
        },
        {
            "name": "工单已下达",
            "code": "KZ_WO_RELEASED",
            "type": "internal",
            "description": "工单下达后通知创建人",
            "subject": "【工单下达】{work_order_code}",
            "content": "工单 {work_order_code} 已下达。\n产品：{product_name}\n数量：{quantity}\n计划开工：{planned_start_date}",
            "variables": {
                "work_order_code": "工单号",
                "product_name": "产品",
                "quantity": "数量",
                "planned_start_date": "计划开工",
            },
            "is_active": True,
        },
        {
            "name": "工单已完工",
            "code": "KZ_WO_COMPLETED",
            "type": "internal",
            "description": "工单末道工序完工后通知创建人",
            "subject": "【工单完工】{work_order_code}",
            "content": "工单 {work_order_code} 已全部完工。\n产品：{product_name}\n完工数量：{completed_quantity}\n请安排后续入库或发货。",
            "variables": {
                "work_order_code": "工单号",
                "product_name": "产品",
                "completed_quantity": "完工数量",
            },
            "is_active": True,
        },
        {
            "name": "工单转返工",
            "code": "KZ_WO_REWORKED",
            "type": "internal",
            "description": "原工单生成返工单后通知创建人",
            "subject": "【返工】原工单 {work_order_code}",
            "content": "原工单 {work_order_code} 已生成返工单 {rework_order_code}。\n产品：{product_name}\n返工数量：{quantity}\n原因：{rework_reason}",
            "variables": {
                "work_order_code": "原工单号",
                "rework_order_code": "返工单号",
                "product_name": "产品",
                "quantity": "返工数量",
                "rework_reason": "返工原因",
            },
            "is_active": True,
        },
        {
            "name": "质量异常已分派",
            "code": "KZ_QE_ASSIGNED",
            "type": "internal",
            "description": "质量异常分派处理人后通知",
            "subject": "【质量异常】{exception_code} 已分派",
            "content": "质量异常 {exception_code} 已分派给 {assigned_to_name} 处理。\n物料：{material_name}\n严重度：{severity}\n描述：{problem_description}",
            "variables": {
                "exception_code": "异常编号",
                "assigned_to_name": "处理人",
                "material_name": "物料",
                "severity": "严重度",
                "problem_description": "问题描述",
            },
            "is_active": True,
        },
        {
            "name": "设备故障已派工",
            "code": "KZ_EQ_ASSIGNED",
            "type": "internal",
            "description": "设备故障派工维修后通知维修人",
            "subject": "【设备派工】{fault_no}",
            "content": "设备故障 {fault_no} 已派工维修。\n设备：{equipment_label}\n维修人：{repairer_name}\n描述：{fault_description}",
            "variables": {
                "fault_no": "故障单号",
                "equipment_label": "设备",
                "repairer_name": "维修人",
                "fault_description": "描述",
            },
            "is_active": True,
        },
        {
            "name": "设备故障已恢复",
            "code": "KZ_EQ_RESOLVED",
            "type": "internal",
            "description": "设备故障维修完成后通知报修人/创建人",
            "subject": "【设备恢复】{fault_no}",
            "content": "设备故障 {fault_no} 已恢复。\n设备：{equipment_label}\n维修人：{repairer_name}\n结果：{repair_result}",
            "variables": {
                "fault_no": "故障单号",
                "equipment_label": "设备",
                "repairer_name": "维修人",
                "repair_result": "维修结果",
            },
            "is_active": True,
        },
        {
            "name": "库存预警触发",
            "code": "KZ_INV_ALERT",
            "type": "internal",
            "description": "库存低于/高于阈值触发预警时通知",
            "subject": "【库存预警】{material_name}",
            "content": "物料 {material_code} {material_name} 触发{alert_type_label}预警。\n仓库：{warehouse_name}\n当前库存：{current_quantity}\n阈值：{threshold_value}\n{alert_message}",
            "variables": {
                "material_code": "物料编码",
                "material_name": "物料名称",
                "warehouse_name": "仓库",
                "alert_type_label": "预警类型",
                "current_quantity": "当前库存",
                "threshold_value": "阈值",
                "alert_message": "预警说明",
            },
            "is_active": True,
        },
        {
            "name": "采购到货逾期",
            "code": "KZ_PO_ARRIVAL_OVERDUE",
            "type": "internal",
            "description": "采购订单行级到货逾期日检提醒",
            "subject": "【到货逾期】采购订单 {order_code}",
            "content": "采购订单 {order_code} 存在 {overdue_line_count} 行到货逾期。\n供应商：{supplier_name}\n请尽快跟进收货。",
            "variables": {
                "order_code": "订单号",
                "overdue_line_count": "逾期行数",
                "supplier_name": "供应商",
            },
            "is_active": True,
        },
        {
            "name": "发货通知已确认",
            "code": "KZ_SHIP_CONFIRMED",
            "type": "internal",
            "description": "发货通知确认通知仓库发货后提醒业务",
            "subject": "【发货确认】{notice_code}",
            "content": "发货通知 {notice_code} 已确认发货。\n销售订单：{sales_order_code}\n客户：{customer_name}\n计划发货：{planned_ship_date}",
            "variables": {
                "notice_code": "通知单号",
                "sales_order_code": "销售订单",
                "customer_name": "客户",
                "planned_ship_date": "计划发货日期",
            },
            "is_active": True,
        },
        {
            "name": "设备点位告警",
            "code": "IOT_ALERT_THRESHOLD",
            "type": "internal",
            "description": "快数采点位阈值告警触发时发送的站内信",
            "subject": "【设备告警】{device_name}",
            "content": "设备 {device_name} 触发告警规则「{rule_name}」。\n点位：{tag_key}\n详情：{message}\n请尽快处理。",
            "variables": {
                "rule_name": "规则名称",
                "device_name": "设备名称",
                "tag_key": "点位",
                "message": "告警详情",
            },
            "is_active": True,
        },
        {
            "name": "设备离线告警",
            "code": "IOT_DEVICE_OFFLINE",
            "type": "internal",
            "description": "快数采设备离线时发送的站内信",
            "subject": "【设备离线】{device_name}",
            "content": "设备 {device_name} 已离线。\n规则：{rule_name}\n详情：{message}\n请尽快处理。",
            "variables": {
                "rule_name": "规则名称",
                "device_name": "设备名称",
                "tag_key": "点位",
                "message": "告警详情",
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

