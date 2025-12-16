"""
通知模型模块

定义通知数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Notification(BaseModel):
    """
    通知模型
    
    用于管理通知，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        notification_no: 通知编号（组织内唯一）
        notification_type: 通知类型（系统通知、审批通知、会议通知等）
        notification_title: 通知标题
        notification_content: 通知内容
        recipient_id: 接收人ID（关联master-data）
        recipient_name: 接收人姓名
        sender_id: 发送人ID（关联master-data）
        sender_name: 发送人姓名
        send_date: 发送日期
        read_date: 阅读日期
        is_read: 是否已读
        push_method: 推送方式（站内信、邮件、短信、APP推送等）
        push_status: 推送状态（待推送、推送中、已推送、推送失败）
        status: 状态（有效、已删除）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaioa_notifications"
        indexes = [
            ("tenant_id",),
            ("notification_no",),
            ("uuid",),
            ("notification_type",),
            ("recipient_id",),
            ("sender_id",),
            ("send_date",),
            ("is_read",),
            ("push_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "notification_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    notification_no = fields.CharField(max_length=50, description="通知编号（组织内唯一）")
    notification_type = fields.CharField(max_length=50, null=True, description="通知类型（系统通知、审批通知、会议通知等）")
    notification_title = fields.CharField(max_length=200, null=True, description="通知标题")
    notification_content = fields.TextField(null=True, description="通知内容")
    
    # 接收人信息
    recipient_id = fields.IntField(null=True, description="接收人ID（关联master-data）")
    recipient_name = fields.CharField(max_length=100, null=True, description="接收人姓名")
    
    # 发送人信息
    sender_id = fields.IntField(null=True, description="发送人ID（关联master-data）")
    sender_name = fields.CharField(max_length=100, null=True, description="发送人姓名")
    send_date = fields.DatetimeField(null=True, description="发送日期")
    read_date = fields.DatetimeField(null=True, description="阅读日期")
    is_read = fields.BooleanField(default=False, description="是否已读")
    
    # 推送信息
    push_method = fields.CharField(max_length=50, null=True, description="推送方式（站内信、邮件、短信、APP推送等）")
    push_status = fields.CharField(max_length=50, default="待推送", description="推送状态（待推送、推送中、已推送、推送失败）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待处理", description="状态（有效、已删除）")
    
    def __str__(self):
        return f"{self.notification_no} - {self.notification_title or '未命名'}"

