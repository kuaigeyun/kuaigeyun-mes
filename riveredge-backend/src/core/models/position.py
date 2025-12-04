"""
职位模型模块

定义职位数据模型，关联部门。
"""

from tortoise import fields
from .base import BaseModel


class Position(BaseModel):
    """
    职位模型
    
    用于定义组织中的职位，每个职位可以关联到一个部门。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 职位ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 职位名称
        code: 职位代码（可选，用于程序识别）
        description: 职位描述
        department_id: 所属部门ID（外键，关联 sys_departments，可选）
        sort_order: 排序顺序
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="职位ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    name = fields.CharField(max_length=100, description="职位名称")
    code = fields.CharField(max_length=50, null=True, description="职位代码（可选，用于程序识别）")
    description = fields.TextField(null=True, description="职位描述")
    
    # 关联部门
    department_id = fields.IntField(null=True, description="所属部门ID（外键，关联 core_departments，内部使用自增ID）")
    
    # 排序和状态
    sort_order = fields.IntField(default=0, description="排序顺序")
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_positions"
        indexes = [
            ("tenant_id",),
            ("department_id",),
            ("code",),
            ("sort_order",),
            ("created_at",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code or 'N/A'})"

