"""
成本中心模型模块

定义成本中心数据模型，支持多组织隔离。
按照中国财务规范：成本中心管理。
"""

from tortoise import fields
from core.models.base import BaseModel


class CostCenter(BaseModel):
    """
    成本中心模型
    
    用于管理成本中心，支持多组织隔离。
    按照中国财务规范：成本中心管理。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        center_code: 成本中心编码（组织内唯一）
        center_name: 成本中心名称
        center_type: 成本中心类型（生产中心、服务中心、管理中心等）
        department_id: 部门ID（关联master-data）
        parent_id: 父成本中心ID（用于成本中心层级）
        level: 成本中心层级
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiacc_cost_centers"
        indexes = [
            ("tenant_id",),
            ("center_code",),
            ("uuid",),
            ("center_type",),
            ("department_id",),
            ("parent_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "center_code")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    center_code = fields.CharField(max_length=50, description="成本中心编码（组织内唯一）")
    center_name = fields.CharField(max_length=200, description="成本中心名称")
    center_type = fields.CharField(max_length=50, description="成本中心类型（生产中心、服务中心、管理中心等）")
    
    # 关联信息
    department_id = fields.IntField(null=True, description="部门ID（关联master-data）")
    
    # 层级信息
    parent_id = fields.IntField(null=True, description="父成本中心ID（用于成本中心层级）")
    level = fields.IntField(default=1, description="成本中心层级")
    
    # 状态
    status = fields.CharField(max_length=20, default="启用", description="状态（启用、停用）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.center_code} - {self.center_name}"

