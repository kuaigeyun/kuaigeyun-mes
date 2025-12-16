"""
会计科目模型模块

定义会计科目数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class AccountSubject(BaseModel):
    """
    会计科目模型
    
    用于管理会计科目，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        subject_code: 科目编码（组织内唯一）
        subject_name: 科目名称
        subject_type: 科目类型（资产、负债、所有者权益、收入、费用）
        parent_id: 父科目ID（用于科目层级）
        level: 科目层级（1-5级）
        is_leaf: 是否末级科目
        direction: 余额方向（借方、贷方）
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiacc_account_subjects"
        indexes = [
            ("tenant_id",),
            ("subject_code",),
            ("uuid",),
            ("subject_type",),
            ("parent_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "subject_code")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    subject_code = fields.CharField(max_length=50, description="科目编码（组织内唯一，按中国会计准则4-2-2-2结构）")
    subject_name = fields.CharField(max_length=200, description="科目名称")
    subject_type = fields.CharField(max_length=50, description="科目类型（资产、负债、所有者权益、收入、费用）")
    
    # 科目层级（中国会计准则通常为4级：一级4位，二级2位，三级2位，四级2位）
    parent_id = fields.IntField(null=True, description="父科目ID（用于科目层级）")
    level = fields.IntField(default=1, description="科目层级（1-4级，按中国会计准则）")
    is_leaf = fields.BooleanField(default=True, description="是否末级科目")
    
    # 科目属性（中国会计准则）
    direction = fields.CharField(max_length=20, default="借方", description="余额方向（借方、贷方）")
    # 资产、成本、费用类科目余额方向为借方；负债、所有者权益、收入类科目余额方向为贷方
    status = fields.CharField(max_length=20, default="启用", description="状态（启用、停用）")
    
    # 辅助核算（中国财务常用功能）
    assist_accounting = fields.JSONField(null=True, description="辅助核算（客户、供应商、部门、项目等）")
    currency = fields.CharField(max_length=10, null=True, description="币种（人民币、美元等，默认人民币）")
    quantity_unit = fields.CharField(max_length=20, null=True, description="数量单位（用于数量金额式账页）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.subject_code} - {self.subject_name}"

