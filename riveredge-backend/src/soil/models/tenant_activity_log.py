"""
组织活动日志模型模块

定义组织活动日志数据模型，用于记录组织的重要操作
"""

from tortoise import fields

from soil.models.base import BaseModel


class TenantActivityLog(BaseModel):
    """
    组织活动日志模型
    
    记录组织的重要操作，便于审计和问题排查。
    只记录关键操作（创建、激活、停用、套餐变更等），不记录所有操作。
    
    Attributes:
        id: 日志 ID（主键）
        tenant_id: 组织 ID（用于多组织数据隔离）
        action: 操作类型（如：create, activate, deactivate, update_plan 等）
        description: 操作描述（详细说明）
        operator_id: 操作人 ID（可选）
        operator_name: 操作人名称（可选）
        created_at: 创建时间（操作时间）
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="日志 ID（主键）")
    tenant_id = fields.IntField(description="组织 ID（用于多组织数据隔离）")
    action = fields.CharField(max_length=50, description="操作类型（如：create, activate, deactivate, update_plan 等）")
    description = fields.TextField(description="操作描述（详细说明）")
    operator_id = fields.IntField(null=True, description="操作人 ID（可选）")
    operator_name = fields.CharField(max_length=100, null=True, description="操作人名称（可选）")
    
    class Meta:
        """
        模型元数据
        """
        table = "tree_tenant_activity_logs"  # 表名必须包含模块前缀（tree_ - 租户管理）
        indexes = [
            ("tenant_id",),  # 组织 ID 索引
            ("created_at",),  # 创建时间索引
            ("action",),  # 操作类型索引
        ]
    
    def __str__(self) -> str:
        """
        返回日志的字符串表示
        
        Returns:
            str: 日志字符串表示
        """
        return f"<TenantActivityLog(id={self.id}, tenant_id={self.tenant_id}, action={self.action})>"

