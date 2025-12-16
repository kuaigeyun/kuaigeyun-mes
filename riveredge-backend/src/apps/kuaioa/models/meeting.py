"""
会议管理模型模块

定义会议管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Meeting(BaseModel):
    """
    会议模型
    
    用于管理会议，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        meeting_no: 会议编号（组织内唯一）
        meeting_name: 会议名称
        meeting_type: 会议类型（例会、专题会、评审会等）
        meeting_date: 会议日期
        start_time: 开始时间
        end_time: 结束时间
        meeting_location: 会议地点
        organizer_id: 组织人ID（关联master-data）
        organizer_name: 组织人姓名
        participant_count: 参与人数
        resource_id: 资源ID（关联MeetingResource）
        reminder_time: 提醒时间
        status: 状态（待预约、已预约、进行中、已结束、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaioa_meetings"
        indexes = [
            ("tenant_id",),
            ("meeting_no",),
            ("uuid",),
            ("meeting_name",),
            ("meeting_type",),
            ("meeting_date",),
            ("organizer_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "meeting_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    meeting_no = fields.CharField(max_length=50, description="会议编号（组织内唯一）")
    meeting_name = fields.CharField(max_length=200, description="会议名称")
    meeting_type = fields.CharField(max_length=50, null=True, description="会议类型（例会、专题会、评审会等）")
    meeting_date = fields.DatetimeField(description="会议日期")
    start_time = fields.DatetimeField(null=True, description="开始时间")
    end_time = fields.DatetimeField(null=True, description="结束时间")
    meeting_location = fields.CharField(max_length=200, null=True, description="会议地点")
    
    # 组织人信息
    organizer_id = fields.IntField(description="组织人ID（关联master-data）")
    organizer_name = fields.CharField(max_length=100, description="组织人姓名")
    participant_count = fields.IntField(default=0, description="参与人数")
    
    # 资源信息
    resource_id = fields.IntField(null=True, description="资源ID（关联MeetingResource）")
    reminder_time = fields.DatetimeField(null=True, description="提醒时间")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待预约", description="状态（待预约、已预约、进行中、已结束、已取消）")
    
    def __str__(self):
        return f"{self.meeting_no} - {self.meeting_name}"


class MeetingMinutes(BaseModel):
    """
    会议纪要模型
    
    用于管理会议纪要，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        minutes_no: 纪要编号（组织内唯一）
        meeting_id: 会议ID（关联Meeting）
        minutes_title: 纪要标题
        minutes_content: 纪要内容
        key_points: 会议要点
        action_items: 行动项（JSON格式）
        recorder_id: 记录人ID（关联master-data）
        recorder_name: 记录人姓名
        reviewer_id: 审核人ID（关联master-data）
        reviewer_name: 审核人姓名
        approval_status: 审核状态（待审核、已通过、已拒绝）
        status: 状态（草稿、待审核、已发布、已归档）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaioa_meeting_minutes"
        indexes = [
            ("tenant_id",),
            ("minutes_no",),
            ("uuid",),
            ("meeting_id",),
            ("minutes_title",),
            ("recorder_id",),
            ("approval_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "minutes_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    minutes_no = fields.CharField(max_length=50, description="纪要编号（组织内唯一）")
    meeting_id = fields.IntField(description="会议ID（关联Meeting）")
    minutes_title = fields.CharField(max_length=200, description="纪要标题")
    minutes_content = fields.TextField(null=True, description="纪要内容")
    key_points = fields.TextField(null=True, description="会议要点")
    action_items = fields.JSONField(null=True, description="行动项（JSON格式）")
    
    # 记录人信息
    recorder_id = fields.IntField(description="记录人ID（关联master-data）")
    recorder_name = fields.CharField(max_length=100, description="记录人姓名")
    
    # 审核人信息
    reviewer_id = fields.IntField(null=True, description="审核人ID（关联master-data）")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    approval_status = fields.CharField(max_length=50, null=True, description="审核状态（待审核、已通过、已拒绝）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、待审核、已发布、已归档）")
    
    def __str__(self):
        return f"{self.minutes_no} - {self.minutes_title}"


class MeetingResource(BaseModel):
    """
    会议资源模型
    
    用于管理会议资源，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        resource_no: 资源编号（组织内唯一）
        resource_name: 资源名称
        resource_type: 资源类型（会议室、投影仪、音响等）
        resource_location: 资源位置
        capacity: 容量（人数）
        equipment: 设备清单（JSON格式）
        status: 状态（可用、使用中、维护中、已停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaioa_meeting_resources"
        indexes = [
            ("tenant_id",),
            ("resource_no",),
            ("uuid",),
            ("resource_name",),
            ("resource_type",),
            ("resource_location",),
            ("status",),
        ]
        unique_together = [("tenant_id", "resource_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    resource_no = fields.CharField(max_length=50, description="资源编号（组织内唯一）")
    resource_name = fields.CharField(max_length=200, description="资源名称")
    resource_type = fields.CharField(max_length=50, description="资源类型（会议室、投影仪、音响等）")
    resource_location = fields.CharField(max_length=200, null=True, description="资源位置")
    capacity = fields.IntField(null=True, description="容量（人数）")
    equipment = fields.JSONField(null=True, description="设备清单（JSON格式）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="可用", description="状态（可用、使用中、维护中、已停用）")
    
    def __str__(self):
        return f"{self.resource_no} - {self.resource_name}"

