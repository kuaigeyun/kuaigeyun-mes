"""
公告通知模型模块

定义公告通知数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Notice(BaseModel):
    """
    公告模型
    
    用于管理公告，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        notice_no: 公告编号（组织内唯一）
        notice_title: 公告标题
        notice_type: 公告类型（通知、公告、公示等）
        notice_content: 公告内容
        publish_date: 发布日期
        expiry_date: 到期日期
        priority: 优先级（低、中、高、紧急）
        publisher_id: 发布人ID（关联master-data）
        publisher_name: 发布人姓名
        reviewer_id: 审核人ID（关联master-data）
        reviewer_name: 审核人姓名
        approval_status: 审核状态（待审核、已通过、已拒绝）
        view_count: 查看次数
        status: 状态（草稿、待审核、已发布、已下架、已过期）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaioa_notices"
        indexes = [
            ("tenant_id",),
            ("notice_no",),
            ("uuid",),
            ("notice_title",),
            ("notice_type",),
            ("publish_date",),
            ("priority",),
            ("approval_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "notice_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    notice_no = fields.CharField(max_length=50, description="公告编号（组织内唯一）")
    notice_title = fields.CharField(max_length=200, description="公告标题")
    notice_type = fields.CharField(max_length=50, description="公告类型（通知、公告、公示等）")
    notice_content = fields.TextField(null=True, description="公告内容")
    publish_date = fields.DatetimeField(null=True, description="发布日期")
    expiry_date = fields.DatetimeField(null=True, description="到期日期")
    priority = fields.CharField(max_length=50, default="中", description="优先级（低、中、高、紧急）")
    
    # 发布人信息
    publisher_id = fields.IntField(description="发布人ID（关联master-data）")
    publisher_name = fields.CharField(max_length=100, description="发布人姓名")
    
    # 审核人信息
    reviewer_id = fields.IntField(null=True, description="审核人ID（关联master-data）")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    approval_status = fields.CharField(max_length=50, null=True, description="审核状态（待审核、已通过、已拒绝）")
    
    # 统计信息
    view_count = fields.IntField(default=0, description="查看次数")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、待审核、已发布、已下架、已过期）")
    
    def __str__(self):
        return f"{self.notice_no} - {self.notice_title}"


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
        table = "seed_kuaioa_notifications"
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
    notification_type = fields.CharField(max_length=50, description="通知类型（系统通知、审批通知、会议通知等）")
    notification_title = fields.CharField(max_length=200, description="通知标题")
    notification_content = fields.TextField(null=True, description="通知内容")
    
    # 接收人信息
    recipient_id = fields.IntField(description="接收人ID（关联master-data）")
    recipient_name = fields.CharField(max_length=100, description="接收人姓名")
    
    # 发送人信息
    sender_id = fields.IntField(null=True, description="发送人ID（关联master-data）")
    sender_name = fields.CharField(max_length=100, null=True, description="发送人姓名")
    send_date = fields.DatetimeField(description="发送日期")
    read_date = fields.DatetimeField(null=True, description="阅读日期")
    is_read = fields.BooleanField(default=False, description="是否已读")
    
    # 推送信息
    push_method = fields.CharField(max_length=50, null=True, description="推送方式（站内信、邮件、短信、APP推送等）")
    push_status = fields.CharField(max_length=50, default="待推送", description="推送状态（待推送、推送中、已推送、推送失败）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="有效", description="状态（有效、已删除）")
    
    def __str__(self):
        return f"{self.notification_no} - {self.notification_title}"

