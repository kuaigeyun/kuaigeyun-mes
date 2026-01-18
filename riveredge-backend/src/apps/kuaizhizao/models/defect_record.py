"""
不良品记录数据模型模块

定义不良品记录数据模型，关联报工记录，支持不良品隔离、返工处理、报废处理等。

Author: Luigi Lu
Date: 2025-01-04
"""

from tortoise import fields
from core.models.base import BaseModel


class DefectRecord(BaseModel):
    """
    不良品记录模型

    用于记录生产过程中的不良品情况，关联报工记录，支持隔离、返工、报废等处理方式。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 不良品记录编码（组织内唯一）
        reporting_record_id: 报工记录ID（关联ReportingRecord）
        work_order_id: 工单ID
        work_order_code: 工单编码
        operation_id: 工序ID
        operation_code: 工序编码
        operation_name: 工序名称
        product_id: 产品ID
        product_code: 产品编码
        product_name: 产品名称
        defect_quantity: 不良品数量
        defect_type: 不良品类型（dimension/appearance/function/material/other）
        defect_reason: 不良品原因
        disposition: 处理方式（quarantine/rework/scrap/accept/other）
        quarantine_location: 隔离位置（当处理方式为隔离时使用）
        rework_order_id: 返工单ID（当处理方式为返工时关联）
        scrap_record_id: 报废记录ID（当处理方式为报废时关联）
        status: 状态（draft/processed/cancelled）
        processed_at: 处理时间
        processed_by: 处理人ID
        processed_by_name: 处理人姓名
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
        table = "apps_kuaizhizao_defect_records"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("reporting_record_id",),
            ("incoming_inspection_id",),
            ("process_inspection_id",),
            ("finished_goods_inspection_id",),
            ("work_order_id",),
            ("operation_id",),
            ("defect_type",),
            ("disposition",),
            ("status",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 基本信息
    code = fields.CharField(max_length=50, description="不良品记录编码（组织内唯一）")

    # 关联信息
    reporting_record_id = fields.IntField(null=True, description="报工记录ID（关联ReportingRecord）")
    # 关联检验单（支持从不合格检验单创建不合格品记录）
    incoming_inspection_id = fields.IntField(null=True, description="来料检验单ID（关联IncomingInspection）")
    incoming_inspection_code = fields.CharField(max_length=50, null=True, description="来料检验单编码")
    process_inspection_id = fields.IntField(null=True, description="过程检验单ID（关联ProcessInspection）")
    process_inspection_code = fields.CharField(max_length=50, null=True, description="过程检验单编码")
    finished_goods_inspection_id = fields.IntField(null=True, description="成品检验单ID（关联FinishedGoodsInspection）")
    finished_goods_inspection_code = fields.CharField(max_length=50, null=True, description="成品检验单编码")
    work_order_id = fields.IntField(null=True, description="工单ID（可选，从检验单获取）")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单编码")
    operation_id = fields.IntField(null=True, description="工序ID（可选，从过程检验单获取）")
    operation_code = fields.CharField(max_length=50, null=True, description="工序编码")
    operation_name = fields.CharField(max_length=200, null=True, description="工序名称")
    product_id = fields.IntField(description="产品ID")
    product_code = fields.CharField(max_length=50, description="产品编码")
    product_name = fields.CharField(max_length=200, description="产品名称")

    # 不良品信息
    defect_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="不良品数量")
    defect_type = fields.CharField(max_length=20, default="other", description="不良品类型（dimension/appearance/function/material/other）")
    defect_reason = fields.TextField(description="不良品原因")
    disposition = fields.CharField(max_length=20, default="quarantine", description="处理方式（quarantine/rework/scrap/accept/other）")

    # 处理相关信息
    quarantine_location = fields.CharField(max_length=200, null=True, description="隔离位置（当处理方式为隔离时使用）")
    rework_order_id = fields.IntField(null=True, description="返工单ID（当处理方式为返工时关联）")
    scrap_record_id = fields.IntField(null=True, description="报废记录ID（当处理方式为报废时关联）")

    # 状态信息
    status = fields.CharField(max_length=20, default="draft", description="状态（draft/processed/cancelled）")
    processed_at = fields.DatetimeField(null=True, description="处理时间")
    processed_by = fields.IntField(null=True, description="处理人ID")
    processed_by_name = fields.CharField(max_length=100, null=True, description="处理人姓名")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.product_name} ({self.defect_quantity})"

