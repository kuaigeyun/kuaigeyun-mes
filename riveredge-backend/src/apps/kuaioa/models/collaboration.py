"""制造协同申请模型。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaSpecialPriceRequest(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    request_code = fields.CharField(max_length=50, description="申请单号")
    title = fields.CharField(max_length=200, description="标题")
    customer_name = fields.CharField(max_length=200, null=True, description="客户")
    material_code = fields.CharField(max_length=100, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    current_price = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="现行价")
    requested_price = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="申请价")
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="数量")
    valid_until = fields.DateField(null=True, description="有效期")
    reason = fields.TextField(null=True, description="申请理由")
    source_app = fields.CharField(max_length=50, null=True, description="来源应用")
    source_entity_type = fields.CharField(max_length=50, null=True, description="来源实体类型")
    source_entity_id = fields.IntField(null=True, description="来源实体ID")
    source_doc_no = fields.CharField(max_length=100, null=True, description="来源单号")
    status = fields.CharField(max_length=30, default="draft", description="状态")
    applicant_id = fields.IntField(null=True, description="申请人")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人姓名")
    department_name = fields.CharField(max_length=100, null=True, description="申请部门")
    notes = fields.TextField(null=True, description="备注")
    submitted_at = fields.DatetimeField(null=True, description="提交时间")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_special_price_requests"
        table_description = "轻办公 - 特价申请"
        unique_together = (("tenant_id", "request_code"),)
        indexes = [("tenant_id", "status"), ("tenant_id", "applicant_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KuaioaConcessionRequest(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    request_code = fields.CharField(max_length=50, description="申请单号")
    title = fields.CharField(max_length=200, description="标题")
    source_app = fields.CharField(max_length=50, null=True, description="来源应用")
    source_entity_type = fields.CharField(max_length=50, null=True, description="来源实体类型")
    source_entity_id = fields.IntField(null=True, description="来源实体ID")
    source_doc_no = fields.CharField(max_length=100, null=True, description="来源单号")
    material_code = fields.CharField(max_length=100, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    concession_qty = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="让步数量")
    defect_description = fields.TextField(null=True, description="缺陷描述")
    notify_customer = fields.BooleanField(default=False, description="是否告知客户")
    status = fields.CharField(max_length=30, default="draft", description="状态")
    applicant_id = fields.IntField(null=True, description="申请人")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人姓名")
    department_name = fields.CharField(max_length=100, null=True, description="申请部门")
    notes = fields.TextField(null=True, description="备注")
    submitted_at = fields.DatetimeField(null=True, description="提交时间")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_concession_requests"
        table_description = "轻办公 - 让步接收申请"
        unique_together = (("tenant_id", "request_code"),)
        indexes = [("tenant_id", "status"), ("tenant_id", "applicant_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KuaioaProcessDeviation(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    request_code = fields.CharField(max_length=50, description="申请单号")
    title = fields.CharField(max_length=200, description="标题")
    source_app = fields.CharField(max_length=50, null=True, description="来源应用")
    source_entity_type = fields.CharField(max_length=50, null=True, description="来源实体类型")
    source_entity_id = fields.IntField(null=True, description="来源实体ID")
    source_doc_no = fields.CharField(max_length=100, null=True, description="来源单号")
    operation_name = fields.CharField(max_length=200, null=True, description="工序")
    deviation_description = fields.TextField(null=True, description="偏离说明")
    start_at = fields.DatetimeField(null=True, description="开始时间")
    end_at = fields.DatetimeField(null=True, description="结束时间")
    risk_assessment = fields.TextField(null=True, description="风险评估")
    temporary_measure = fields.TextField(null=True, description="临时措施")
    status = fields.CharField(max_length=30, default="draft", description="状态")
    applicant_id = fields.IntField(null=True, description="申请人")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人姓名")
    department_name = fields.CharField(max_length=100, null=True, description="申请部门")
    notes = fields.TextField(null=True, description="备注")
    submitted_at = fields.DatetimeField(null=True, description="提交时间")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_process_deviations"
        table_description = "轻办公 - 工艺偏离申请"
        unique_together = (("tenant_id", "request_code"),)
        indexes = [("tenant_id", "status"), ("tenant_id", "applicant_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]
