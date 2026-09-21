"""R-03 供应商评价与环保资料（质量管理；供应商主体引用主数据）。"""

from tortoise import fields

from core.models.base import BaseModel


class SupplierEvalTemplate(BaseModel):
    """评价模板（条款权重 + 等级分档版本；与主数据运营评级无关）。"""

    class Meta:
        table = "apps_kuaizhizao_supplier_eval_templates"
        table_description = "快制造 - 供应商评价模板"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id", "is_active"), ("uuid",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=50, description="模板编码")
    name = fields.CharField(max_length=200, description="模板名称")
    version = fields.CharField(
        max_length=40, default="v1", description="评分公式版本"
    )
    grade_version = fields.CharField(
        max_length=40, default="v1", description="等级分档版本"
    )
    grade_bands = fields.JSONField(
        null=True,
        description='等级分档 [{"min":90,"grade":"A"},...] 按 min 降序匹配',
    )
    period_type = fields.CharField(
        max_length=20,
        null=True,
        description="适用周期 annual/quarterly；空表示通用",
    )
    is_active = fields.BooleanField(default=True)
    remarks = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class SupplierEvalTemplateClause(BaseModel):
    """评价模板条款。"""

    class Meta:
        table = "apps_kuaizhizao_supplier_eval_template_clauses"
        table_description = "快制造 - 供应商评价模板条款"
        indexes = [("tenant_id", "template_id"), ("uuid",)]

    id = fields.IntField(pk=True)
    template_id = fields.IntField()
    line_no = fields.IntField(default=1)
    clause_code = fields.CharField(max_length=50)
    clause_name = fields.CharField(max_length=200)
    weight = fields.DecimalField(max_digits=10, decimal_places=4, default=1)
    max_score = fields.DecimalField(max_digits=10, decimal_places=2, default=100)
    remarks = fields.CharField(max_length=500, null=True)
    deleted_at = fields.DatetimeField(null=True)


class SupplierEvaluation(BaseModel):
    """年/季供应商评价单头。"""

    class Meta:
        table = "apps_kuaizhizao_supplier_evaluations"
        table_description = "快制造 - 供应商评价"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "supplier_id"),
            ("tenant_id", "period_year", "period_type"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=50, description="评价单号")
    period_type = fields.CharField(
        max_length=20,
        default="annual",
        description="annual/quarterly",
    )
    period_year = fields.IntField(description="评价年度")
    period_quarter = fields.IntField(null=True, description="季度 1-4（季评必填）")
    supplier_id = fields.IntField(description="主数据供应商 ID")
    supplier_code = fields.CharField(max_length=80, null=True)
    supplier_name = fields.CharField(max_length=200, null=True)
    template_id = fields.IntField(null=True, description="评价模板 ID")
    template_code = fields.CharField(max_length=50, null=True)
    template_name = fields.CharField(max_length=200, null=True)
    plan_id = fields.IntField(null=True, description="来源评价计划 ID")
    plan_code = fields.CharField(max_length=50, null=True)
    audit_mode = fields.CharField(
        max_length=20,
        default="document",
        description="onsite 现场 / document 书面",
    )
    score = fields.DecimalField(max_digits=8, decimal_places=2, null=True)
    grade = fields.CharField(max_length=8, null=True, description="评价等级")
    formula_version = fields.CharField(
        max_length=40,
        null=True,
        description="评分公式版本（创建/重算取自模板；批准后冻结）",
    )
    grade_version = fields.CharField(
        max_length=40,
        null=True,
        description="等级版本（创建/重算取自模板；批准后冻结）",
    )
    needs_rectification = fields.BooleanField(default=False)
    rectification_plan = fields.TextField(null=True)
    rectification_due = fields.DateField(null=True)
    rectification_status = fields.CharField(
        max_length=20,
        default="none",
        description="none/open/closed",
    )
    rectification_result = fields.TextField(null=True)
    rectification_closed_at = fields.DatetimeField(null=True)
    rectification_closed_by = fields.IntField(null=True)
    rectification_closed_by_name = fields.CharField(max_length=100, null=True)
    status = fields.CharField(
        max_length=30,
        default="draft",
        description="draft/pending/approved/rejected/revoked",
    )
    attachments = fields.JSONField(null=True)
    submitted_at = fields.DatetimeField(null=True)
    approved_at = fields.DatetimeField(null=True)
    revoked_at = fields.DatetimeField(null=True)
    revoked_by = fields.IntField(null=True)
    revoked_by_name = fields.CharField(max_length=100, null=True)
    revoke_reason = fields.TextField(null=True)
    remarks = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class SupplierEvaluationLine(BaseModel):
    """评价单打分明细（自模板快照；已批准禁止改写）。"""

    class Meta:
        table = "apps_kuaizhizao_supplier_evaluation_lines"
        table_description = "快制造 - 供应商评价明细"
        indexes = [("tenant_id", "evaluation_id"), ("uuid",)]

    id = fields.IntField(pk=True)
    evaluation_id = fields.IntField()
    line_no = fields.IntField(default=1)
    clause_code = fields.CharField(max_length=50)
    clause_name = fields.CharField(max_length=200)
    weight = fields.DecimalField(max_digits=10, decimal_places=4, default=1)
    max_score = fields.DecimalField(max_digits=10, decimal_places=2, default=100)
    score = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    remarks = fields.CharField(max_length=500, null=True)
    deleted_at = fields.DatetimeField(null=True)


class SupplierEvalPlan(BaseModel):
    """年/季评价计划（覆盖供应商清单；生成评价单，不重建供应商）。"""

    class Meta:
        table = "apps_kuaizhizao_supplier_eval_plans"
        table_description = "快制造 - 供应商评价计划"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "period_year", "period_type"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=50)
    name = fields.CharField(max_length=200)
    period_type = fields.CharField(max_length=20, default="annual")
    period_year = fields.IntField()
    period_quarter = fields.IntField(null=True)
    template_id = fields.IntField(description="评价模板 ID")
    template_code = fields.CharField(max_length=50, null=True)
    template_name = fields.CharField(max_length=200, null=True)
    audit_mode = fields.CharField(max_length=20, default="document")
    reminder_lead_days = fields.IntField(
        default=7, description="评价截止前提醒提前天数"
    )
    status = fields.CharField(
        max_length=30,
        default="draft",
        description="draft/released/closed",
    )
    remarks = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class SupplierEvalPlanLine(BaseModel):
    """评价计划覆盖供应商行。"""

    class Meta:
        table = "apps_kuaizhizao_supplier_eval_plan_lines"
        table_description = "快制造 - 供应商评价计划行"
        indexes = [("tenant_id", "plan_id"), ("uuid",)]

    id = fields.IntField(pk=True)
    plan_id = fields.IntField()
    line_no = fields.IntField(default=1)
    supplier_id = fields.IntField()
    supplier_code = fields.CharField(max_length=80, null=True)
    supplier_name = fields.CharField(max_length=200, null=True)
    remarks = fields.CharField(max_length=500, null=True)
    deleted_at = fields.DatetimeField(null=True)


class SupplierEvalEnvDocument(BaseModel):
    """供应商环保资料清单项（挂主数据供应商；非资质证书字段）。"""

    class Meta:
        table = "apps_kuaizhizao_supplier_eval_env_docs"
        table_description = "快制造 - 供应商环保资料"
        indexes = [
            ("tenant_id", "supplier_id"),
            ("tenant_id", "expires_at"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True)
    supplier_id = fields.IntField(description="主数据供应商 ID")
    supplier_code = fields.CharField(max_length=80, null=True)
    supplier_name = fields.CharField(max_length=200, null=True)
    doc_type = fields.CharField(max_length=40, default="other")
    title = fields.CharField(max_length=200)
    issued_at = fields.DateField(null=True)
    expires_at = fields.DateField(null=True, description="有效期至（提醒真源）")
    reminder_lead_days = fields.IntField(
        null=True, description="到期前提醒提前天数；空则默认30"
    )
    attachments = fields.JSONField(null=True)
    remarks = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)
