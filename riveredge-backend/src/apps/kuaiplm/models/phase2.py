"""
快研发二期模型：需求 / 设计评审 / FMEA

Author: RiverEdge Team
Date: 2026-05-28
"""

from tortoise import fields

from core.models.base import BaseModel


class RdRequirement(BaseModel):
    """研发需求"""

    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(null=True, description="项目ID")
    requirement_code = fields.CharField(max_length=50, null=True, description="需求编码")
    title = fields.CharField(max_length=300, description="标题")
    description = fields.TextField(null=True, description="描述")
    priority = fields.CharField(max_length=20, default="normal", description="优先级")
    status = fields.CharField(max_length=30, default="DRAFT", description="状态")
    source_type = fields.CharField(max_length=50, null=True, description="来源类型")
    source_id = fields.IntField(null=True, description="来源ID")
    created_by = fields.IntField(null=True)
    updated_by = fields.IntField(null=True)
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiplm_rd_requirements"
        table_description = "快研发 - 研发需求"
        indexes = [("tenant_id", "project_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class RdDesignReview(BaseModel):
    """设计评审"""

    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(null=True, description="项目ID")
    review_code = fields.CharField(max_length=50, null=True, description="评审编码")
    title = fields.CharField(max_length=300, description="标题")
    review_type = fields.CharField(max_length=50, null=True, description="评审类型")
    status = fields.CharField(max_length=30, default="PLANNED", description="状态")
    material_id = fields.IntField(null=True, description="物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    reviewer_id = fields.IntField(null=True, description="评审人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="评审人姓名")
    review_date = fields.DateField(null=True, description="评审日期")
    review_notes = fields.TextField(null=True, description="评审意见")
    created_by = fields.IntField(null=True)
    updated_by = fields.IntField(null=True)
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiplm_rd_design_reviews"
        table_description = "快研发 - 设计评审"
        indexes = [("tenant_id", "project_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class RdFmeaRecord(BaseModel):
    """FMEA 记录"""

    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(null=True, description="项目ID")
    fmea_code = fields.CharField(max_length=50, null=True, description="FMEA编码")
    title = fields.CharField(max_length=300, description="标题")
    fmea_type = fields.CharField(max_length=20, default="DFMEA", description="FMEA类型")
    status = fields.CharField(max_length=30, default="DRAFT", description="状态")
    material_id = fields.IntField(null=True, description="物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    risk_items = fields.JSONField(null=True, description="风险项")
    created_by = fields.IntField(null=True)
    updated_by = fields.IntField(null=True)
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiplm_rd_fmea_records"
        table_description = "快研发 - FMEA 记录"
        indexes = [("tenant_id", "project_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]
