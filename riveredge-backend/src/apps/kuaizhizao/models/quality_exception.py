"""
质量异常记录数据模型模块

定义质量异常记录数据模型，用于记录和处理质量问题。

Author: Luigi Lu
Date: 2025-01-15
"""

from tortoise import fields
from core.models.base import BaseModel


class QualityException(BaseModel):
    """
    质量异常记录模型

    用于记录质量问题信息，包括问题描述、追溯信息、纠正预防措施等。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        exception_type: 异常类型（inspection_failure/process_deviation/customer_complaint）
        work_order_id: 关联工单ID（可选）
        work_order_code: 关联工单编码（可选）
        material_id: 关联物料ID（可选）
        material_code: 关联物料编码（可选）
        material_name: 关联物料名称（可选）
        batch_no: 批次号（可选）
        inspection_record_id: 关联检验记录ID（可选）
        problem_description: 问题描述
        severity: 严重程度（minor/major/critical）
        status: 处理状态（pending/investigating/correcting/closed）
        root_cause: 根本原因（可选）
        corrective_action: 纠正措施（可选）
        preventive_action: 预防措施（可选）
        responsible_person_id: 责任人ID（可选）
        responsible_person_name: 责任人姓名（可选）
        planned_completion_date: 计划完成日期（可选）
        actual_completion_date: 实际完成日期（可选）
        verification_result: 验证结果（可选）
        handled_by: 处理人ID（可选）
        handled_by_name: 处理人姓名（可选）
        handled_at: 处理时间（可选）
        remarks: 备注
        created_at: 创建时间
        updated_at: 更新时间
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_quality_exceptions"
        indexes = [
            ("tenant_id",),
            ("exception_type",),
            ("work_order_id",),
            ("material_id",),
            ("severity",),
            ("status",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 异常类型和关联信息
    exception_type = fields.CharField(max_length=50, description="异常类型")
    work_order_id = fields.IntField(null=True, description="关联工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="关联工单编码")
    material_id = fields.IntField(null=True, description="关联物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="关联物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="关联物料名称")
    batch_no = fields.CharField(max_length=50, null=True, description="批次号")
    inspection_record_id = fields.IntField(null=True, description="关联检验记录ID")

    # 问题描述
    problem_description = fields.TextField(description="问题描述")
    severity = fields.CharField(max_length=20, default="minor", description="严重程度")

    # 处理状态
    status = fields.CharField(max_length=20, default="pending", description="处理状态")

    # 追溯和措施
    root_cause = fields.TextField(null=True, description="根本原因")
    corrective_action = fields.TextField(null=True, description="纠正措施")
    preventive_action = fields.TextField(null=True, description="预防措施")

    # 责任人信息
    responsible_person_id = fields.IntField(null=True, description="责任人ID")
    responsible_person_name = fields.CharField(max_length=100, null=True, description="责任人姓名")
    planned_completion_date = fields.DatetimeField(null=True, description="计划完成日期")
    actual_completion_date = fields.DatetimeField(null=True, description="实际完成日期")
    verification_result = fields.TextField(null=True, description="验证结果")

    # 处理信息
    handled_by = fields.IntField(null=True, description="处理人ID")
    handled_by_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handled_at = fields.DatetimeField(null=True, description="处理时间")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.exception_type} - {self.problem_description[:50]}"

