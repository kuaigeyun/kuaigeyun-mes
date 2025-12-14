"""
绩效数据模型模块

定义绩效数据模型（假期、技能），支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Holiday(BaseModel):
    """
    假期模型
    
    假期信息管理，用于管理组织内的假期安排。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        name: 假期名称
        holiday_date: 假期日期（DATE类型）
        holiday_type: 假期类型（法定节假日、公司假期等）
        description: 描述
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_master_data_holidays"
        indexes = [
            ("tenant_id",),
            ("uuid",),
            ("holiday_date",),
            ("holiday_type",),
        ]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    name = fields.CharField(max_length=200, description="假期名称")
    holiday_date = fields.DateField(description="假期日期")
    holiday_type = fields.CharField(max_length=50, null=True, description="假期类型（法定节假日、公司假期等）")
    description = fields.TextField(null=True, description="描述")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} - {self.holiday_date}"


class Skill(BaseModel):
    """
    技能模型
    
    技能信息管理，用于管理组织内的技能分类。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 技能编码（组织内唯一）
        name: 技能名称
        category: 技能分类
        description: 描述
        is_active: 是否启用
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_master_data_skills"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("category",),
        ]
        unique_together = [("tenant_id", "code")]
    
    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    code = fields.CharField(max_length=50, description="技能编码（组织内唯一）")
    name = fields.CharField(max_length=200, description="技能名称")
    category = fields.CharField(max_length=50, null=True, description="技能分类")
    description = fields.TextField(null=True, description="描述")
    
    # 状态信息
    is_active = fields.BooleanField(default=True, description="是否启用")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.name}"

