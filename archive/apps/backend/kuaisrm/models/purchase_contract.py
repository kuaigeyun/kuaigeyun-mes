"""
采购合同模型模块

定义采购合同数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class PurchaseContract(BaseModel):
    """
    采购合同模型
    
    用于管理采购合同，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        contract_no: 合同编号（组织内唯一）
        contract_name: 合同名称
        supplier_id: 供应商ID（关联master-data）
        contract_date: 合同签订日期
        start_date: 合同开始日期
        end_date: 合同结束日期
        status: 合同状态（草稿、待审批、已审批、执行中、已完成、已终止）
        total_amount: 合同总金额
        currency: 币种
        approval_instance_id: 审批实例ID（关联ApprovalInstance）
        approval_status: 审批状态（pending、approved、rejected、cancelled）
        contract_content: 合同内容（JSON格式）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaisrm_purchase_contracts"
        indexes = [
            ("tenant_id",),
            ("contract_no",),
            ("uuid",),
            ("status",),
            ("supplier_id",),
            ("contract_date",),
            ("start_date",),
            ("end_date",),
            ("approval_instance_id",),
            ("approval_status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "contract_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    contract_no = fields.CharField(max_length=50, description="合同编号（组织内唯一）")
    contract_name = fields.CharField(max_length=200, description="合同名称")
    supplier_id = fields.IntField(description="供应商ID（关联master-data）")
    contract_date = fields.DatetimeField(description="合同签订日期")
    start_date = fields.DatetimeField(null=True, description="合同开始日期")
    end_date = fields.DatetimeField(null=True, description="合同结束日期")
    
    # 合同状态
    status = fields.CharField(max_length=50, default="草稿", description="合同状态（草稿、待审批、已审批、执行中、已完成、已终止）")
    
    # 合同金额
    total_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="合同总金额")
    currency = fields.CharField(max_length=10, default="CNY", description="币种")
    
    # 审批相关字段
    approval_instance_id = fields.IntField(null=True, description="审批实例ID（关联ApprovalInstance）")
    approval_status = fields.CharField(max_length=20, null=True, description="审批状态（pending、approved、rejected、cancelled）")
    
    # 合同内容（JSON格式）
    contract_content = fields.JSONField(null=True, description="合同内容（JSON格式）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 负责人
    owner_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.contract_no} - {self.contract_name}"
