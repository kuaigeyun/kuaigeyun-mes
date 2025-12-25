"""
服务合同模型模块

定义服务合同数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ServiceContract(BaseModel):
    """
    服务合同模型
    
    用于管理服务合同，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        contract_no: 合同编号（组织内唯一）
        customer_id: 客户ID（关联master-data）
        contract_type: 合同类型
        contract_start_date: 合同开始日期
        contract_end_date: 合同结束日期
        contract_status: 合同状态
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicrm_service_contracts"
        indexes = [
            ("tenant_id",),
            ("contract_no",),
            ("uuid",),
            ("contract_status",),
            ("customer_id",),
            ("contract_type",),
        ]
        unique_together = [("tenant_id", "contract_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    contract_no = fields.CharField(max_length=50, description="合同编号（组织内唯一）")
    customer_id = fields.IntField(description="客户ID（关联master-data）")
    contract_type = fields.CharField(max_length=50, description="合同类型")
    
    # 合同期限
    contract_start_date = fields.DatetimeField(description="合同开始日期")
    contract_end_date = fields.DatetimeField(description="合同结束日期")
    contract_status = fields.CharField(max_length=20, default="有效", description="合同状态（有效、已到期、已终止）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.contract_no} - {self.contract_type}"
