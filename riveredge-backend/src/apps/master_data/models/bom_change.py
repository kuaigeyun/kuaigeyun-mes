"""
BOM 工程变更记录模型模块

定义 BOM 工程变更（ECN）数据模型，用于记录 BOM 的变更历史与审批流程。

Author: AI Assistant
Date: 2026-03-16
"""

from tortoise import fields
from core.models.base import BaseModel


class BOMChange(BaseModel):
    """
    BOM 工程变更记录模型

    用于记录 BOM 的变更历史，支持变更申请、审批、执行等流程。

    Attributes:
        id: 变更记录ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        material_id: 主物料ID（BOM 关联的父件物料）
        change_type: 变更类型（item_add/item_remove/item_modify/version_change/effective_change/other）
        change_content: 变更内容（JSON格式，详细记录变更前后对比）
        change_reason: 变更原因
        change_impact: 变更影响分析（JSON格式，记录影响的工单、需求等）
        status: 变更状态（pending/approved/rejected/executed/cancelled）
        applicant_id: 申请人ID
        approver_id: 审批人ID（可选）
        approval_comment: 审批意见（可选）
        applied_at: 应用时间（变更执行时间）
        bom_code: 关联的 BOM 编码（可选，用于精确定位版本）
        from_version: 变更前版本（可选）
        to_version: 变更后版本（可选）
    """

    class Meta:
        table = "apps_master_data_bom_changes"
        table_description = "基础数据管理 - BOM 工程变更"
        indexes = [
            ("tenant_id",),
            ("material_id",),
            ("status",),
            ("change_type",),
            ("applicant_id",),
            ("created_at",),
            ("bom_code",),
        ]

    id = fields.IntField(pk=True, description="变更记录ID（主键，自增ID，内部使用）")

    material = fields.ForeignKeyField(
        "models.Material",
        related_name="bom_changes",
        description="关联主物料（BOM 父件）",
    )

    change_type = fields.CharField(
        max_length=50,
        description="变更类型（item_add:新增子件, item_remove:删除子件, item_modify:修改子件, version_change:版本变更, effective_change:生效日期变更, other:其他）",
    )
    change_content = fields.JSONField(
        null=True,
        description="变更内容（JSON格式，详细记录变更前后对比、影响的BOM明细等）",
    )
    change_reason = fields.TextField(null=True, description="变更原因")
    change_impact = fields.JSONField(
        null=True,
        description="变更影响分析（JSON格式，记录影响的工单、需求、成本等）",
    )

    bom_code = fields.CharField(max_length=100, null=True, description="关联的 BOM 编码（可选）")
    from_version = fields.CharField(max_length=50, null=True, description="变更前版本（可选）")
    to_version = fields.CharField(max_length=50, null=True, description="变更后版本（可选）")

    STATUS_CHOICES = [
        ("pending", "待审批"),
        ("approved", "已审批"),
        ("rejected", "已拒绝"),
        ("executed", "已执行"),
        ("cancelled", "已取消"),
    ]
    status = fields.CharField(
        max_length=20,
        default="pending",
        description="变更状态（pending:待审批, approved:已审批, rejected:已拒绝, executed:已执行, cancelled:已取消）",
    )

    applicant_id = fields.IntField(description="申请人ID")
    approver_id = fields.IntField(null=True, description="审批人ID（可选）")
    approval_comment = fields.TextField(null=True, description="审批意见（可选）")
    applied_at = fields.DatetimeField(null=True, description="应用时间（变更执行时间）")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        material_code = self.material.main_code if self.material else "N/A"
        return f"BOM变更 {material_code} - {self.change_type} ({self.status})"
