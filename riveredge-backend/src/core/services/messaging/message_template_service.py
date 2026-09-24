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
            "name": "销售交期提前提醒",
            "code": "KZ_SALES_DELIVERY_DUE_SOON",
            "type": "internal",
            "description": "销售订单交货日期到期前提醒（提前天数由消息规则配置）",
            "subject": "【交期提醒】销售订单 {order_code} 将于 {delivery_date} 交货",
            "content": "销售订单 {order_code} 将于 {delivery_date} 交货（距交期约 {days_left} 天），客户：{customer_name}。\n请仓库及相关负责人提前备货与安排。",
            "variables": {
                "order_code": "订单号",
                "delivery_date": "交货日期",
                "customer_name": "客户",
                "days_left": "距交期天数",
                "advance_days": "提前提醒天数",
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
            "name": "质检单新建待检",
            "code": "KZ_QUALITY_INSPECTION_CREATED",
            "type": "internal",
            "description": "工单下推或系统创建质检单后提醒质检人员",
            "subject": "【{inspection_type}待办】{inspection_code}",
            "content": (
                "已新建{inspection_type}单 {inspection_code}。\n"
                "来源工单：{work_order_code}\n"
                "物料：{material_name}\n"
                "检验数量：{inspection_quantity}\n"
                "请尽快完成检验。"
            ),
            "variables": {
                "inspection_code": "检验单号",
                "inspection_type": "检验类型",
                "work_order_code": "工单号",
                "material_name": "物料",
                "inspection_quantity": "检验数量",
            },
            "is_active": True,
        },
        {
            "name": "质量投诉时效到期",
            "code": "KZ_QUALITY_COMPLAINT_DUE_OVERDUE",
            "type": "internal",
            "description": "质量投诉到达工作日时效截止时刻仍未关闭",
            "subject": "【投诉时效】{complaint_code} 已到期",
            "content": (
                "质量投诉 {complaint_code}（{title}）已到达要求完成时间 {due_at}，"
                "当前状态 {status}，物料：{material_name}。请尽快处理。"
            ),
            "variables": {
                "complaint_code": "投诉单号",
                "title": "标题",
                "business_type": "业务类型",
                "material_name": "物料",
                "due_at": "要求完成时间",
                "status": "状态",
            },
            "is_active": True,
        },
        {
            "name": "库存验证未开单",
            "code": "KZ_INVENTORY_VERIFY_OPEN_OVERDUE",
            "type": "internal",
            "description": "每月 10 日前仍未开具库存验证返工单",
            "subject": "【库存验证】{verify_month} 未开单",
            "content": (
                "验证月份 {verify_month} 已到开单窗口，系统仍未发现库存验证返工单。"
                "请 OQC 尽快开具返工单进行验证。"
            ),
            "variables": {
                "verify_month": "验证月份",
                "rework_code": "返工单号",
                "product_name": "产品",
                "status": "状态",
            },
            "is_active": True,
        },
        {
            "name": "库存验证月末未完成",
            "code": "KZ_INVENTORY_VERIFY_MONTH_END",
            "type": "internal",
            "description": "库存验证返工单到达月末仍未关闭",
            "subject": "【库存验证】{rework_code} 月末未完成",
            "content": (
                "库存验证返工单 {rework_code}（月份 {verify_month}）已到月末截止时刻，"
                "当前状态 {status}，产品：{product_name}。请尽快完成并关闭。"
            ),
            "variables": {
                "verify_month": "验证月份",
                "rework_code": "返工单号",
                "product_name": "产品",
                "status": "状态",
                "due_at": "截止时间",
            },
            "is_active": True,
        },
        {
            "name": "库存验证PQC已核对",
            "code": "KZ_INVENTORY_VERIFY_PQC_CHECKED",
            "type": "internal",
            "description": "PQC 主管核对库存验证质量记录汇总后通知 OQC",
            "subject": "【库存验证】{rework_code} PQC已核对",
            "content": (
                "库存验证返工单 {rework_code}（月份 {verify_month}）PQC 已核对汇总。"
                "核对人：{pqc_checked_by_name}。请 OQC 查看结果并通知相关人员。"
            ),
            "variables": {
                "verify_month": "验证月份",
                "rework_code": "返工单号",
                "product_name": "产品",
                "pqc_checked_by_name": "核对人",
                "pqc_summary": "汇总摘要",
            },
            "is_active": True,
        },
        {
            "name": "库存验证OQC结果通知",
            "code": "KZ_INVENTORY_VERIFY_OQC_NOTIFIED",
            "type": "internal",
            "description": "OQC 勾选相关人员发送库存验证结果通知",
            "subject": "【库存验证结果】{rework_code}",
            "content": (
                "库存验证返工单 {rework_code}（月份 {verify_month}）结果通知。"
                "产品：{product_name}。汇总：{pqc_summary}"
            ),
            "variables": {
                "verify_month": "验证月份",
                "rework_code": "返工单号",
                "product_name": "产品",
                "pqc_summary": "汇总摘要",
                "pqc_checked_by_name": "核对人",
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
            "name": "设备外校到期前提醒",
            "code": "KZ_EQUIPMENT_CALIBRATION_DUE_SOON",
            "type": "internal",
            "description": "外校计量到期前一个月提醒（站内；邮件/短信请配置对应渠道模板或同码）",
            "subject": "【外校到期】{equipment_code} 将于 {due_date} 到期",
            "content": (
                "设备 {equipment_code} {equipment_name} 外校计量将于 {due_date} 到期"
                "（{reminder_kind}）。请安排送校。"
            ),
            "variables": {
                "equipment_code": "设备编码",
                "equipment_name": "设备名称",
                "due_date": "计量到期日",
                "reminder_kind": "提醒类型",
            },
            "is_active": True,
        },
        {
            "name": "设备外校过期提醒",
            "code": "KZ_EQUIPMENT_CALIBRATION_DUE_OVERDUE",
            "type": "internal",
            "description": "外校计量过期一天提醒",
            "subject": "【外校过期】{equipment_code} 已过期",
            "content": (
                "设备 {equipment_code} {equipment_name} 外校计量已于 {due_date} 到期"
                "（{reminder_kind}）。请尽快处理。"
            ),
            "variables": {
                "equipment_code": "设备编码",
                "equipment_name": "设备名称",
                "due_date": "计量到期日",
                "reminder_kind": "提醒类型",
            },
            "is_active": True,
        },
        {
            "name": "设备外校到期前提醒邮件",
            "code": "KZ_EQUIPMENT_CALIBRATION_DUE_SOON_EMAIL",
            "type": "email",
            "description": "外校计量到期前一个月邮件",
            "subject": "【外校到期】{equipment_code} 将于 {due_date} 到期",
            "content": (
                "<p>设备 <b>{equipment_code}</b> {equipment_name} 外校计量将于 "
                "<b>{due_date}</b> 到期（{reminder_kind}）。请安排送校。</p>"
            ),
            "variables": {
                "equipment_code": "设备编码",
                "equipment_name": "设备名称",
                "due_date": "计量到期日",
                "reminder_kind": "提醒类型",
            },
            "is_active": True,
        },
        {
            "name": "设备外校过期提醒邮件",
            "code": "KZ_EQUIPMENT_CALIBRATION_DUE_OVERDUE_EMAIL",
            "type": "email",
            "description": "外校计量过期一天邮件",
            "subject": "【外校过期】{equipment_code} 已过期",
            "content": (
                "<p>设备 <b>{equipment_code}</b> {equipment_name} 外校计量已于 "
                "<b>{due_date}</b> 到期（{reminder_kind}）。请尽快处理。</p>"
            ),
            "variables": {
                "equipment_code": "设备编码",
                "equipment_name": "设备名称",
                "due_date": "计量到期日",
                "reminder_kind": "提醒类型",
            },
            "is_active": True,
        },
        {
            "name": "设备外校到期前提醒短信",
            "code": "KZ_EQUIPMENT_CALIBRATION_DUE_SOON_SMS",
            "type": "sms",
            "description": "外校计量到期前一个月短信（R-09）",
            "subject": "外校到期提醒",
            "content": "设备{equipment_code}外校将于{due_date}到期，请安排送校。",
            "variables": {
                "equipment_code": "设备编码",
                "due_date": "计量到期日",
            },
            "is_active": True,
        },
        {
            "name": "设备外校过期提醒短信",
            "code": "KZ_EQUIPMENT_CALIBRATION_DUE_OVERDUE_SMS",
            "type": "sms",
            "description": "外校计量过期一天短信（R-09）",
            "subject": "外校过期提醒",
            "content": "设备{equipment_code}外校已于{due_date}过期，请尽快处理。",
            "variables": {
                "equipment_code": "设备编码",
                "due_date": "计量到期日",
            },
            "is_active": True,
        },
        {
            "name": "模具供应商回签到期前提醒",
            "code": "KZ_MOLD_SIGNBACK_DUE_SOON",
            "type": "internal",
            "description": "模具供应商半年回签到期前十四天提醒（R-10）",
            "subject": "【模具回签到期】{mold_code} 将于 {due_date} 到期",
            "content": (
                "模具 {mold_code} {mold_name}（供应商 {supplier}）回签将于 {due_date} 到期"
                "（{reminder_kind}）。请督促供应商回签并上传扫描件。"
            ),
            "variables": {
                "mold_code": "模具编码",
                "mold_name": "模具名称",
                "supplier": "供应商",
                "due_date": "回签到期日",
                "reminder_kind": "提醒类型",
            },
            "is_active": True,
        },
        {
            "name": "模具供应商回签过期未执行提醒",
            "code": "KZ_MOLD_SIGNBACK_DUE_OVERDUE",
            "type": "internal",
            "description": "模具供应商半年回签过期一天未执行提醒（R-10）",
            "subject": "【模具回签过期】{mold_code} 已过期未执行",
            "content": (
                "模具 {mold_code} {mold_name}（供应商 {supplier}）回签已于 {due_date} 到期"
                "（{reminder_kind}）。请尽快登记回签扫描件。"
            ),
            "variables": {
                "mold_code": "模具编码",
                "mold_name": "模具名称",
                "supplier": "供应商",
                "due_date": "回签到期日",
                "reminder_kind": "提醒类型",
            },
            "is_active": True,
        },
        {
            "name": "设备点检待审核",
            "code": "KZ_SPOT_CHECK_SUBMITTED",
            "type": "internal",
            "description": "点检提交后通知指定负责人审核（R-10）",
            "subject": "【点检待审核】{equipment_code} {document_no}",
            "content": (
                "设备 {equipment_code} {equipment_name} 点检单 {document_no}"
                "（点检日 {check_date}，点检人 {inspector_name}）待审核，请尽快确认。"
            ),
            "variables": {
                "document_no": "点检单号",
                "equipment_code": "设备编码",
                "equipment_name": "设备名称",
                "check_date": "点检日期",
                "inspector_name": "点检人",
            },
            "is_active": True,
        },
        {
            "name": "设备点检未点检或未审核超时",
            "code": "KZ_SPOT_CHECK_DUE_OVERDUE",
            "type": "internal",
            "description": "周期内未点检或提交后未审核超时报警（R-10）",
            "subject": "【点检超时】{equipment_code} {reminder_kind}",
            "content": (
                "设备 {equipment_code} {equipment_name} 点检超时（{reminder_kind}）。"
                "点检日 {check_date}，单据 {document_no}。请尽快完成点检或审核。"
            ),
            "variables": {
                "document_no": "点检单号",
                "equipment_code": "设备编码",
                "equipment_name": "设备名称",
                "check_date": "点检日期",
                "reminder_kind": "提醒类型",
                "scheme_name": "点检方案",
            },
            "is_active": True,
        },
        {
            "name": "设备换线后未初检超时",
            "code": "KZ_LINE_REBIND_FORCE_SPOT_OVERDUE",
            "type": "internal",
            "description": "换线完成后未在时限内完成强制初检（R-10）",
            "subject": "【换线未初检】{equipment_code} {production_line_name}",
            "content": (
                "设备 {equipment_code} {equipment_name} 已换线至 {production_line_name}"
                "（单号 {document_no}），超过时限仍未完成强制初检，请尽快点检。"
            ),
            "variables": {
                "document_no": "换线单号",
                "equipment_code": "设备编码",
                "equipment_name": "设备名称",
                "production_line_code": "产线编码",
                "production_line_name": "产线名称",
                "force_spot_check_due_at": "初检时限",
            },
            "is_active": True,
        },
        {
            "name": "设备维修到场超时",
            "code": "KZ_EQUIPMENT_FAULT_ARRIVAL_OVERDUE",
            "type": "internal",
            "description": "报障后未在规定时限内到场签到（R-10）",
            "subject": "【到场超时】{equipment_code} {fault_no}",
            "content": (
                "设备 {equipment_code} {equipment_name} 故障单 {fault_no}"
                "超过规定到场时限（{response_minutes} 分钟，截止 {response_due_at}）仍未签到，请尽快到场。"
            ),
            "variables": {
                "fault_no": "故障单号",
                "equipment_code": "设备编码",
                "equipment_name": "设备名称",
                "response_minutes": "到场时限分钟",
                "response_due_at": "到场截止时刻",
            },
            "is_active": True,
        },
        {
            "name": "供应商环保资料到期前提醒",
            "code": "KZ_SUPPLIER_ENV_DUE_SOON",
            "type": "internal",
            "description": "供应商环保资料到期前一个月提醒（R-03）",
            "subject": "【环保资料到期】{supplier_code} {doc_title}",
            "content": (
                "供应商 {supplier_code} {supplier_name} 的环保资料「{doc_title}」"
                "将于 {due_date} 到期（{reminder_kind}）。请及时更新。"
            ),
            "variables": {
                "supplier_code": "供应商编码",
                "supplier_name": "供应商名称",
                "doc_title": "资料标题",
                "doc_type": "资料类型",
                "due_date": "有效期至",
                "reminder_kind": "提醒类型",
            },
            "is_active": True,
        },
        {
            "name": "供应商环保资料过期提醒",
            "code": "KZ_SUPPLIER_ENV_DUE_OVERDUE",
            "type": "internal",
            "description": "供应商环保资料过期提醒（R-03）",
            "subject": "【环保资料过期】{supplier_code} {doc_title}",
            "content": (
                "供应商 {supplier_code} {supplier_name} 的环保资料「{doc_title}」"
                "已于 {due_date} 到期（{reminder_kind}）。请尽快处理。"
            ),
            "variables": {
                "supplier_code": "供应商编码",
                "supplier_name": "供应商名称",
                "doc_title": "资料标题",
                "doc_type": "资料类型",
                "due_date": "有效期至",
                "reminder_kind": "提醒类型",
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
            "name": "采购变更单待审核",
            "code": "KZ_POC_SUBMITTED",
            "type": "internal",
            "description": "采购变更单提交后提醒审核人",
            "subject": "【采购变更单】{change_code} 待审核",
            "content": "采购变更单 {change_code} 已提交待审核。\n原采购订单：{source_order_code}\n供应商：{supplier_name}\n变更原因：{change_reason}",
            "variables": {
                "change_code": "变更单号",
                "source_order_code": "原采购订单",
                "supplier_name": "供应商",
                "change_reason": "变更原因",
            },
            "is_active": True,
        },
        {
            "name": "采购变更单已审核",
            "code": "KZ_POC_APPROVED",
            "type": "internal",
            "description": "采购变更单审核通过后提醒跟单",
            "subject": "【采购变更单】{change_code} 已审核",
            "content": "采购变更单 {change_code} 已审核通过。\n原采购订单：{source_order_code}\n供应商：{supplier_name}",
            "variables": {
                "change_code": "变更单号",
                "source_order_code": "原采购订单",
                "supplier_name": "供应商",
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
            "name": "工序完成后通知下一工序",
            "code": "KZ_WO_NEXT_OPERATION",
            "type": "internal",
            "description": "当前工序完成后提醒下一工序指派人",
            "subject": "【工序交接】工单 {work_order_code} 可开工「{next_operation_name}」",
            "content": "工单 {work_order_code} 的工序「{completed_operation_name}」已完成。\n产品：{product_name}\n下一工序：{next_operation_name}\n请及时安排开工或报工。",
            "variables": {
                "work_order_code": "工单号",
                "product_name": "产品",
                "completed_operation_name": "已完成工序",
                "next_operation_name": "下一工序",
            },
            "is_active": True,
        },
        {
            "name": "工序派工提醒",
            "code": "KZ_WO_OPERATION_ASSIGNED",
            "type": "internal",
            "description": "工序临时派工后通知被指派人员",
            "subject": "【工序派工】工单 {work_order_code}「{operation_name}」",
            "content": "工单 {work_order_code} 的工序「{operation_name}」已派工给您。\n产品：{product_name}\n派工人：{assigned_by_name}\n请及时查看并安排生产。",
            "variables": {
                "work_order_code": "工单号",
                "product_name": "产品",
                "operation_name": "工序",
                "assigned_by_name": "派工人",
                "assigned_worker_name": "被派工人",
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
            "name": "试流待审超时",
            "code": "PLM_TRIAL_APPROVAL_OVERDUE",
            "type": "internal",
            "description": "试流单提交后超过约定时长仍未审核",
            "subject": "【试流待审】{trial_code} 已超过 {delay_hours} 小时",
            "content": (
                "试流单 {trial_code}（{title}）项目 {project_name}（{project_code}）"
                "已超过 {delay_hours} 小时未审核，请尽快处理。"
            ),
            "variables": {
                "trial_code": "试流单号",
                "title": "标题",
                "project_code": "项目代号",
                "project_name": "项目名称",
                "business_type": "业务类型",
                "delay_hours": "超时小时数",
            },
            "is_active": True,
        },
        {
            "name": "试流工序超时",
            "code": "PLM_TRIAL_STEP_OVERDUE",
            "type": "internal",
            "description": "试流执行中当前工序超过约定时长未填报",
            "subject": "【试流工序】{trial_code} 工序 {step_key} 已超过 {delay_hours} 小时",
            "content": (
                "试流单 {trial_code}（{title}）当前工序 {step_key} 已超过 {delay_hours} 小时"
                "未填报，请责任部门尽快处理。"
            ),
            "variables": {
                "trial_code": "试流单号",
                "title": "标题",
                "project_code": "项目代号",
                "project_name": "项目名称",
                "step_key": "工序",
                "delay_hours": "超时小时数",
            },
            "is_active": True,
        },
        {
            "name": "PLM 待审超时",
            "code": "PLM_PENDING_APPROVAL_OVERDUE",
            "type": "internal",
            "description": "研发交付物/固件/生产文件提交后超过 24 小时仍未审核",
            "subject": "【待审超时】{doc_label}{doc_code} 已超过 {delay_hours} 小时",
            "content": (
                "{doc_label}{doc_code}（{title}）"
                " 项目 {project_code} 已超过 {delay_hours} 小时未审核，请尽快处理。"
            ),
            "variables": {
                "doc_code": "单号或名称",
                "title": "标题",
                "project_code": "项目代号（可选前缀）",
                "doc_label": "单据类型标签",
                "delay_hours": "超时小时数",
                "entity_type": "实体类型",
            },
            "is_active": True,
        },
        {
            "name": "通用会签待审超时",
            "code": "KUAIOA_FORM_REQUEST_OVERDUE",
            "type": "internal",
            "description": "5M/物料申请/样品检验等通用会签提交后超过 8 小时仍未审核",
            "subject": "【会签待审】{request_code} 已超过 {delay_hours} 小时",
            "content": (
                "申请 {request_code}（{title}）类型 {business_type} "
                "已超过 {delay_hours} 小时未审核，请尽快处理。"
            ),
            "variables": {
                "request_code": "申请单号",
                "title": "标题",
                "business_type": "业务类型",
                "delay_hours": "超时小时数",
            },
            "is_active": True,
        },
        {
            "name": "实验委托待受理",
            "code": "PLM_LAB_REQUEST_SUBMITTED",
            "type": "internal",
            "description": "实验委托进入实验室待受理后通知实验室",
            "subject": "【实验委托待受理】{lab_code} {title}",
            "content": (
                "实验委托 {lab_code}（{title}）已进入待受理，请实验室尽快受理并安排实验。"
            ),
            "variables": {
                "lab_code": "委托单号",
                "title": "试验名称",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "实验委托已完成",
            "code": "PLM_LAB_REQUEST_COMPLETED",
            "type": "internal",
            "description": "实验委托完成后通知申请人查看结果",
            "subject": "【实验委托已完成】{lab_code} {title}",
            "content": (
                "实验委托 {lab_code}（{title}）已完成，判定：{judgment}。请登录系统查看实验结果与报告。"
            ),
            "variables": {
                "lab_code": "委托单号",
                "title": "试验名称",
                "judgment": "判定结果",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "实验报告待批准",
            "code": "PLM_LAB_REPORT_SUBMITTED",
            "type": "internal",
            "description": "实验委托报告提交审批后通知批准人",
            "subject": "【实验报告待批准】{lab_code} {report_title}",
            "content": (
                "实验委托 {lab_code}（{title}）报告「{report_title}」已提交审批，请尽快批准。"
            ),
            "variables": {
                "lab_code": "委托单号",
                "title": "试验名称",
                "report_title": "报告标题",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "实验报告已批准",
            "code": "PLM_LAB_REPORT_APPROVED",
            "type": "internal",
            "description": "实验委托报告批准后通知创建人与提交人",
            "subject": "【实验报告已批准】{lab_code} {report_title}",
            "content": (
                "实验委托 {lab_code}（{title}）报告「{report_title}」已批准。"
            ),
            "variables": {
                "lab_code": "委托单号",
                "title": "试验名称",
                "report_title": "报告标题",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "实验报告已驳回",
            "code": "PLM_LAB_REPORT_REJECTED",
            "type": "internal",
            "description": "实验委托报告驳回后通知创建人与提交人",
            "subject": "【实验报告已驳回】{lab_code} {report_title}",
            "content": (
                "实验委托 {lab_code}（{title}）报告「{report_title}」已驳回。"
                "原因：{reject_reason}"
            ),
            "variables": {
                "lab_code": "委托单号",
                "title": "试验名称",
                "report_title": "报告标题",
                "reject_reason": "驳回原因",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "工程变更关闭广播",
            "code": "PLM_ECN_CLOSED",
            "type": "internal",
            "description": "ERP 稽核通过后通知常规采购、前期采购及会签相关人员",
            "subject": "【工程变更已关闭】{ecn_code} {title}",
            "content": (
                "变更单 {ecn_code}（{title}）已在 ERP 完成更新并通过稽核，"
                "ERP 单号 {erp_ecn_no}。请各部门按各自处理意见执行。"
            ),
            "variables": {
                "ecn_code": "变更单号",
                "title": "标题",
                "erp_ecn_no": "ERP 单号",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "年度例式下月任务提醒",
            "code": "PLM_ANNUAL_LAB_MONTH_DUE",
            "type": "internal",
            "description": "年度例式实验计划月度任务到期前提醒责任人",
            "subject": "【年度例式】{year_month} {month_title} 任务即将到期",
            "content": (
                "年度计划 {plan_code}（{plan_title}）{year_month} 任务「{month_title}」"
                "将于 {due_at} 到期，责任人 {owner_user_name}，请按计划执行实验、上传报告并记录不良。"
            ),
            "variables": {
                "plan_code": "计划单号",
                "plan_title": "计划标题",
                "year_month": "任务月份",
                "month_title": "月度任务",
                "owner_user_name": "责任人",
                "due_at": "到期时刻",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "部门培训申请窗口提醒",
            "code": "OA_TRAINING_DEPT_APPLICATION_WINDOW",
            "type": "internal",
            "description": "每年 11 月部门培训申请窗口提醒",
            "subject": "【部门培训申请】{plan_year} 年度申请窗口",
            "content": (
                "{plan_year} 年度部门培训申请窗口提醒。"
                "待提交草稿数：{open_draft_count}。"
                "请各部门填写培训内容并提交。入口：{detail_path}"
            ),
            "variables": {
                "plan_year": "计划年度",
                "open_draft_count": "待提交草稿数",
                "detail_path": "详情路径",
                "due_at": "提醒时间",
            },
            "is_active": True,
        },
        {
            "name": "年度培训计划窗口提醒",
            "code": "OA_TRAINING_ANNUAL_PLAN_WINDOW",
            "type": "internal",
            "description": "每年 12 月年度培训计划编制窗口提醒",
            "subject": "【年度培训计划】{plan_year} 年度编制提醒",
            "content": (
                "请人力资源部依据部门申请编制 {plan_year} 年度培训计划并提交审批。"
                "入口：{detail_path}"
            ),
            "variables": {
                "plan_year": "计划年度",
                "detail_path": "详情路径",
                "due_at": "提醒时间",
            },
            "is_active": True,
        },
        {
            "name": "年度培训计划批准下发",
            "code": "OA_TRAINING_ANNUAL_PLAN_DISTRIBUTED",
            "type": "internal",
            "description": "年度培训计划审批通过后下发各部门及体系查阅",
            "subject": "【年度培训计划】{plan_year} 年度已下发",
            "content": (
                "{plan_year} 年度培训计划（{plan_code} {plan_name}）已批准下发，"
                "请本部门查阅。入口：{detail_path}"
            ),
            "variables": {
                "plan_year": "计划年度",
                "plan_code": "计划编号",
                "plan_name": "计划名称",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "培训内容记录逾期提醒",
            "code": "OA_TRAINING_CONTENT_DUE",
            "type": "internal",
            "description": "培训内容记录未完成或未确认提醒",
            "subject": "【培训内容】{training_name} 待完成",
            "content": (
                "培训记录 {record_code}（{training_name}）要求完成期限 {due_date}，"
                "请上传培训内容并由人力资源确认。入口：{detail_path}"
            ),
            "variables": {
                "record_code": "记录编号",
                "training_name": "培训名称",
                "due_date": "要求完成期限",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "特殊作业资格确认窗口提醒",
            "code": "OA_TRAINING_SPECIAL_WORK_WINDOW",
            "type": "internal",
            "description": "每年 6 月特殊作业资格确认窗口提醒",
            "subject": "【特殊作业资格】{qualification_year} 年度确认提醒",
            "content": (
                "请完成 {qualification_year} 年度特殊作业人员资格鉴定确认并提交审批。"
                "入口：{detail_path}"
            ),
            "variables": {
                "qualification_year": "认定年度",
                "detail_path": "详情路径",
                "due_at": "提醒时间",
            },
            "is_active": True,
        },
        {
            "name": "上岗证到期提醒",
            "code": "OA_TRAINING_LICENSE_EXPIRING",
            "type": "internal",
            "description": "上岗证到期前提醒",
            "subject": "【上岗证到期】{license_name}",
            "content": (
                "上岗证 {license_code}（{license_name}）持有人 {holder_name} "
                "将于 {expiry_date} 到期，请及时处理。入口：{detail_path}"
            ),
            "variables": {
                "license_code": "证书编号",
                "license_name": "证书名称",
                "holder_name": "持有人",
                "expiry_date": "到期日期",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "证照协议到期前提醒",
            "code": "OA_COMPLIANCE_LICENSE_DUE_SOON",
            "type": "internal",
            "description": "证照或协议到期前提醒（渠道可在规则中勾选邮件/短信）",
            "subject": "【证照到期提醒】{license_name}",
            "content": (
                "证照 {license_code}（{license_name}，类型 {license_type}）"
                "持有主体 {holder_name} 将于 {expiry_date} 到期（{reminder_kind}）。"
                "入口：{detail_path}"
            ),
            "variables": {
                "license_code": "证照编号",
                "license_name": "证照名称",
                "license_type": "证照类型",
                "holder_name": "持有主体",
                "expiry_date": "到期日期",
                "reminder_kind": "提醒类型",
                "detail_path": "详情路径",
            },
            "is_active": True,
        },
        {
            "name": "证照协议已到期提醒",
            "code": "OA_COMPLIANCE_LICENSE_DUE_OVERDUE",
            "type": "internal",
            "description": "证照或协议到期日提醒（渠道可在规则中勾选邮件/短信）",
            "subject": "【证照已到期】{license_name}",
            "content": (
                "证照 {license_code}（{license_name}，类型 {license_type}）"
                "持有主体 {holder_name} 已于 {expiry_date} 到期（{reminder_kind}）。"
                "入口：{detail_path}"
            ),
            "variables": {
                "license_code": "证照编号",
                "license_name": "证照名称",
                "license_type": "证照类型",
                "holder_name": "持有主体",
                "expiry_date": "到期日期",
                "reminder_kind": "提醒类型",
                "detail_path": "详情路径",
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

