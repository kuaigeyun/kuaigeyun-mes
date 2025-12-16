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
        table = "apps_kuaioa_notices"
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

# Notification 已移至独立文件 notification.py

