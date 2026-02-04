"""
报废记录数据模型模块

定义报废记录数据模型，关联报工记录，支持报废原因记录、成本计算等。

Author: Luigi Lu
Date: 2025-01-04
"""

from tortoise import fields
from core.models.base import BaseModel


class ScrapRecord(BaseModel):
    """
    报废记录模型

    用于记录生产过程中的报废情况，关联报工记录，支持成本计算和库存扣减。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 报废单编码（组织内唯一）
        reporting_record_id: 报工记录ID（关联ReportingRecord）
        work_order_id: 工单ID
        work_order_code: 工单编码
        operation_id: 工序ID
        operation_code: 工序编码
        operation_name: 工序名称
        product_id: 产品ID
        product_code: 产品编码
        product_name: 产品名称
        scrap_quantity: 报废数量
        unit_cost: 单位成本
        total_cost: 总成本
        scrap_reason: 报废原因
        scrap_type: 报废类型（process/material/quality/equipment/other）
        warehouse_id: 仓库ID（用于库存扣减）
        warehouse_name: 仓库名称
        status: 状态（draft/confirmed/cancelled）
        confirmed_at: 确认时间
        confirmed_by: 确认人ID
        confirmed_by_name: 确认人姓名
        remarks: 备注
        created_by: 创建人ID
        created_by_name: 创建人姓名
        updated_by: 更新人ID
        updated_by_name: 更新人姓名
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_scrap_records"
        table_description = "快格轻制造 - 报废记录"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("reporting_record_id",),
            ("work_order_id",),
            ("operation_id",),
            ("status",),
            ("scrap_type",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 基本信息
    code = fields.CharField(max_length=50, description="报废单编码（组织内唯一）")

    # 关联信息
    reporting_record_id = fields.IntField(null=True, description="报工记录ID（关联ReportingRecord）")
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")
    operation_id = fields.IntField(description="工序ID")
    operation_code = fields.CharField(max_length=50, description="工序编码")
    operation_name = fields.CharField(max_length=200, description="工序名称")
    product_id = fields.IntField(description="产品ID")
    product_code = fields.CharField(max_length=50, description="产品编码")
    product_name = fields.CharField(max_length=200, description="产品名称")

    # 报废信息
    scrap_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="报废数量")
    unit_cost = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="单位成本")
    total_cost = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总成本")
    scrap_reason = fields.TextField(description="报废原因")
    scrap_type = fields.CharField(max_length=20, default="other", description="报废类型（process/material/quality/equipment/other）")

    # 库存信息
    warehouse_id = fields.IntField(null=True, description="仓库ID（用于库存扣减）")
    warehouse_name = fields.CharField(max_length=200, null=True, description="仓库名称")

    # 状态信息
    status = fields.CharField(max_length=20, default="draft", description="状态（draft/confirmed/cancelled）")
    confirmed_at = fields.DatetimeField(null=True, description="确认时间")
    confirmed_by = fields.IntField(null=True, description="确认人ID")
    confirmed_by_name = fields.CharField(max_length=100, null=True, description="确认人姓名")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.product_name} ({self.scrap_quantity})"

