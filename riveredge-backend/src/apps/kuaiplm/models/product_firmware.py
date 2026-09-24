"""产品固件（R-15 #28）"""

from tortoise import fields

from core.models.base import BaseModel


class ProductFirmware(BaseModel):
    """研发项目产品固件版本台账。"""

    class Meta:
        table = "apps_kuaiplm_product_firmwares"
        table_description = "快研发 - 产品固件"
        unique_together = [("tenant_id", "firmware_code")]
        indexes = [
            ("tenant_id", "project_id"),
            ("tenant_id", "status"),
            ("tenant_id", "release_date"),
            ("uuid",),
        ]

    id = fields.IntField(pk=True, description="主键")
    firmware_code = fields.CharField(max_length=50, description="固件单号")
    project_id = fields.IntField(null=True, description="研发项目ID（可选；存量项目可仅填代号）")
    project_code = fields.CharField(max_length=50, description="项目代号快照")
    project_name = fields.CharField(max_length=200, description="项目名称快照")
    version = fields.CharField(max_length=50, description="固件版本号")
    release_date = fields.DateField(null=True, description="发布日期")
    title = fields.CharField(max_length=200, description="固件标题")
    status = fields.CharField(
        max_length=20,
        default="draft",
        description="draft/pending/approved/released/obsolete",
    )
    file_uuid = fields.CharField(max_length=36, null=True, description="core file UUID")
    file_name = fields.CharField(max_length=200, null=True, description="文件名快照")
    checksum = fields.CharField(max_length=128, null=True, description="校验和")
    change_summary = fields.TextField(null=True, description="版本说明")
    remarks = fields.TextField(null=True, description="备注")
    submitted_at = fields.DatetimeField(null=True, description="提交时间")
    approved_at = fields.DatetimeField(null=True, description="审核通过时间")
    released_at = fields.DatetimeField(null=True, description="发布/可生产下载时间")
    obsolete_at = fields.DatetimeField(null=True, description="作废时间")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
