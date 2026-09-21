"""项目建议书（R-15 #68）

销售发起 → 采购填写供应商 → 审批 → 下发研发。
"""

from tortoise import fields

from core.models.base import BaseModel


class ProjectProposal(BaseModel):
    """项目建议书。"""

    class Meta:
        table = "apps_kuaiplm_project_proposals"
        table_description = "快研发 - 项目建议书"
        unique_together = [("tenant_id", "proposal_code")]
        indexes = [
            ("tenant_id", "project_id"),
            ("tenant_id", "status"),
            ("tenant_id", "supplier_id"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    proposal_code = fields.CharField(max_length=50, description="建议书单号")
    project_id = fields.IntField(description="研发项目ID")
    project_code = fields.CharField(max_length=50, description="项目代号快照")
    project_name = fields.CharField(max_length=200, description="项目名称快照")
    title = fields.CharField(max_length=200, description="标题")
    summary = fields.TextField(null=True, description="开发要求概述")
    customer_name = fields.CharField(max_length=200, null=True, description="客户名称")
    expected_date = fields.DateField(null=True, description="期望推进日期")
    product_lines = fields.JSONField(default=list, description="产品类型 rf/ir/remote")
    proposing_dept = fields.CharField(max_length=32, null=True, description="提出部门")
    proposer_name = fields.CharField(max_length=100, null=True, description="提出人")
    proposed_at = fields.DateField(null=True, description="项目提出日期")
    sample_date = fields.DateField(null=True, description="送样日期")
    mass_production_date = fields.DateField(null=True, description="量产日期")
    sample_quantity = fields.CharField(max_length=80, null=True, description="送样数量")
    customer_code = fields.CharField(max_length=80, null=True, description="客户代码")
    contact_name = fields.CharField(max_length=100, null=True, description="联系人")
    contact_phone = fields.CharField(max_length=50, null=True, description="联系电话")
    contact_email = fields.CharField(max_length=200, null=True, description="联系邮箱")
    customer_product_model = fields.CharField(max_length=200, null=True, description="客户产品型号")
    customer_material_types = fields.JSONField(default=list, description="客户资料类型")
    dev_req_types = fields.JSONField(default=list, description="开发要求分类 A-F")
    company_product_model = fields.CharField(max_length=200, null=True, description="整机型号")
    cost_change_notes = fields.TextField(null=True, description="涉及成本变化内容")
    supplier_assessment_lines = fields.JSONField(default=list, description="供应商评审行")
    procurement_reviewer_name = fields.CharField(max_length=100, null=True, description="采购评审人")
    # 采购填写（遗留单供应商字段，列表摘要用）
    supplier_id = fields.IntField(null=True, description="供应商ID")
    supplier_code = fields.CharField(max_length=80, null=True, description="供应商编码快照")
    supplier_name = fields.CharField(max_length=200, null=True, description="供应商名称快照")
    supplier_contact = fields.CharField(max_length=200, null=True, description="供应商联系方式")
    supplier_remark = fields.TextField(null=True, description="采购备注")
    status = fields.CharField(
        max_length=20,
        default="draft",
        description="draft/pending/approved/issued/rejected",
    )
    remarks = fields.TextField(null=True)
    submitted_at = fields.DatetimeField(null=True)
    approved_at = fields.DatetimeField(null=True)
    issued_at = fields.DatetimeField(null=True)
    issued_by = fields.IntField(null=True)
    issued_by_name = fields.CharField(max_length=100, null=True)
    created_by = fields.IntField(null=True)
    created_by_name = fields.CharField(max_length=100, null=True)
    updated_by = fields.IntField(null=True)
    updated_by_name = fields.CharField(max_length=100, null=True)
    deleted_at = fields.DatetimeField(null=True)
