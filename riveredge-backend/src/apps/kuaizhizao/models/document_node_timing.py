"""
单据节点耗时记录数据模型模块

定义单据节点耗时记录数据模型，用于记录单据在各个节点的开始和结束时间。

Author: Luigi Lu
Date: 2025-01-15
"""

from tortoise import fields
from core.models.base import BaseModel


class DocumentNodeTiming(BaseModel):
    """
    单据节点耗时记录模型

    用于记录单据在各个节点的开始和结束时间，支持计算节点耗时。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        document_type: 单据类型（work_order/purchase_order/sales_order等）
        document_id: 单据ID
        document_code: 单据编码
        node_name: 节点名称（如：创建、下达、报工、入库等）
        node_code: 节点编码（如：created/released/reported/received等）
        start_time: 节点开始时间
        end_time: 节点结束时间
        duration_seconds: 节点耗时（秒）
        duration_hours: 节点耗时（小时，排除非工作时间）
        operator_id: 操作人ID
        operator_name: 操作人姓名
        remarks: 备注
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_document_node_timings"
        indexes = [
            ("tenant_id",),
            ("document_type",),
            ("document_id",),
            ("node_code",),
            ("start_time",),
            ("end_time",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 单据信息
    document_type = fields.CharField(max_length=50, description="单据类型")
    document_id = fields.IntField(description="单据ID")
    document_code = fields.CharField(max_length=50, description="单据编码")

    # 节点信息
    node_name = fields.CharField(max_length=100, description="节点名称")
    node_code = fields.CharField(max_length=50, description="节点编码")

    # 时间信息
    start_time = fields.DatetimeField(null=True, description="节点开始时间")
    end_time = fields.DatetimeField(null=True, description="节点结束时间")
    duration_seconds = fields.IntField(null=True, description="节点耗时（秒）")
    duration_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="节点耗时（小时，排除非工作时间）")

    # 操作人信息
    operator_id = fields.IntField(null=True, description="操作人ID")
    operator_name = fields.CharField(max_length=100, null=True, description="操作人姓名")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.document_code} - {self.node_name}"

